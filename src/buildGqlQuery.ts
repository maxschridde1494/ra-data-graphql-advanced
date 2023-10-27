import {
    GET_LIST,
    GET_MANY,
    GET_MANY_REFERENCE,
    DELETE,
    DELETE_MANY,
    UPDATE_MANY,
} from 'ra-core';
import {
    QUERY_TYPES,
    IntrospectionResult,
    IntrospectedResource,
} from 'ra-data-graphql';
import {
    ArgumentNode,
    IntrospectionField,
    IntrospectionNamedTypeRef,
    IntrospectionObjectType,
    IntrospectionUnionType,
    TypeKind,
    VariableDefinitionNode,
} from 'graphql';
import * as gqlTypes from 'graphql-ast-types-browser';

import getFinalType from './getFinalType';
import { getGqlType } from './getGqlType';

import {
    FieldNameConventions,
    FieldNameConventionEnum,
} from './fieldNameConventions';

const defaultFieldsResolutionTypes = [TypeKind.SCALAR]; // unless sparse fields are specified, default fields requested in queries / mutations will be scalars only

type RequestedFields = (string | { [k: string]: RequestedFields })[];
type ExpandedRequestedFields = { linkedType?: string; fields: RequestedFields }[];

function getType(fieldType) {
    if (fieldType.ofType == null) return fieldType.kind;

    return getType(fieldType.ofType);
}

function expandRequestedFields(fields?: RequestedFields) : ExpandedRequestedFields {
    if (!fields) return [];

    return fields.map(f => {
        if (typeof f == 'string') return { fields: [f] };

        const [linkedType, linkedRequestedFields] = Object.entries(f)[0];

        return { linkedType, fields: linkedRequestedFields };
    });
}

function filterPermittedRequestedFields(resourceFNames: string[], requestedfields: ExpandedRequestedFields): ExpandedRequestedFields {
    return requestedfields.filter(rF =>
        resourceFNames.includes((rF.linkedType || rF.fields[0]) as string)
    );
}

function processRequestedFields(
    resourceFields: readonly IntrospectionField[],
    sparseFields?: RequestedFields,
    extraFields?: RequestedFields
): {
    fields: readonly IntrospectionField[];
    linkedRequestedFields: ExpandedRequestedFields;
} {
    const fieldsRequested = sparseFields || extraFields && (sparseFields?.length > 0 || extraFields?.length > 0)
    const defaultResolutionFields = resourceFields.filter(field =>
        defaultFieldsResolutionTypes.includes(getType(field.type))
    )

    if (!fieldsRequested) // default (which is scalar resource fields) if requested fields not specified
        return {
            fields: defaultResolutionFields,
            linkedRequestedFields: [],
        };

    const resourceFNames = resourceFields.map(f => f.name);
    const defaultFNames = defaultResolutionFields.map(f => f.name);
    
    let fields: readonly IntrospectionField[] = [];
    let linkedRequestedFields: ExpandedRequestedFields = []; // requested fields to be used for linked resources / types
    
    if (extraFields?.length > 0) {
        // take precedence over sparse fields
        const expandedExtraFields = expandRequestedFields(extraFields);
        const permittedExtraFields = filterPermittedRequestedFields(resourceFNames, expandedExtraFields);
        const extraFNames = permittedExtraFields.map(eF => eF.linkedType || eF.fields[0]);

        fields = [...defaultResolutionFields, ...resourceFields.filter(rF => extraFNames.includes(rF.name) && !defaultFNames.includes(rF.name))];
        linkedRequestedFields = permittedExtraFields.filter(sF => !!sF.linkedType);
    } else if (sparseFields?.length > 0) {
        // sparse fields only
        const expandedSparseFields = expandRequestedFields(sparseFields);
        const permittedSparseFields = filterPermittedRequestedFields(resourceFNames, expandedSparseFields);
        const sparseFNames = permittedSparseFields.map(sF => sF.linkedType || sF.fields[0]);

        fields = resourceFields.filter(rF => sparseFNames.includes(rF.name));
        linkedRequestedFields = permittedSparseFields.filter(sF => !!sF.linkedType);
    }

    return { fields, linkedRequestedFields };
}

export default (
    introspectionResults: IntrospectionResult,
    fieldNameConvention: FieldNameConventionEnum = FieldNameConventionEnum.CAMEL
) => (
    resource: IntrospectedResource,
    raFetchMethod: string,
    queryType: IntrospectionField,
    variables: any
) => {
    let { sortField, sortOrder, ...metaVariables } = variables;

    const sparseFields = metaVariables.meta?.[FieldNameConventions[fieldNameConvention].strWithConvention('sparseFields')];
    if (sparseFields) delete metaVariables.meta.sparseFields;
    const extraFields = metaVariables.meta?.[FieldNameConventions[fieldNameConvention].strWithConvention('extraFields')];
    if (extraFields) delete metaVariables.meta.extraFields;

    const fields = buildFields(introspectionResults)(
        resource.type.fields,
        sparseFields,
        extraFields
    );
    const apolloArgs = buildApolloArgs(
        queryType,
        variables,
        fieldNameConvention
    );
    const args = buildArgs(queryType, variables, fieldNameConvention);
    const metaArgs = buildArgs(queryType, metaVariables, fieldNameConvention);
    
    if (
        raFetchMethod === GET_LIST ||
        raFetchMethod === GET_MANY ||
        raFetchMethod === GET_MANY_REFERENCE
    ) {
        return gqlTypes.document([
            gqlTypes.operationDefinition(
                'query',
                gqlTypes.selectionSet([
                    gqlTypes.field(
                        gqlTypes.name(queryType.name),
                        gqlTypes.name('items'),
                        args,
                        null,
                        gqlTypes.selectionSet(fields)
                    ),
                    gqlTypes.field(
                        gqlTypes.name(
                            FieldNameConventions[
                                fieldNameConvention
                            ].listQueryToMeta(queryType.name)
                        ),
                        gqlTypes.name('total'),
                        metaArgs,
                        null,
                        gqlTypes.selectionSet([
                            gqlTypes.field(gqlTypes.name('count')),
                        ])
                    ),
                ]),
                gqlTypes.name(queryType.name),
                apolloArgs
            ),
        ]);
    }

    if (raFetchMethod === DELETE) {
        return gqlTypes.document([
            gqlTypes.operationDefinition(
                'mutation',
                gqlTypes.selectionSet([
                    gqlTypes.field(
                        gqlTypes.name(queryType.name),
                        gqlTypes.name('data'),
                        args,
                        null,
                        gqlTypes.selectionSet(fields)
                    ),
                ]),
                gqlTypes.name(queryType.name),
                apolloArgs
            ),
        ]);
    }

    if (raFetchMethod === DELETE_MANY || raFetchMethod === UPDATE_MANY) {
        return gqlTypes.document([
            gqlTypes.operationDefinition(
                'mutation',
                gqlTypes.selectionSet([
                    gqlTypes.field(
                        gqlTypes.name(queryType.name),
                        gqlTypes.name('data'),
                        args,
                        null,
                        gqlTypes.selectionSet([
                            gqlTypes.field(gqlTypes.name('ids')),
                        ])
                    ),
                ]),
                gqlTypes.name(queryType.name),
                apolloArgs
            ),
        ]);
    }

    return gqlTypes.document([
        gqlTypes.operationDefinition(
            QUERY_TYPES.includes(raFetchMethod) ? 'query' : 'mutation',
            gqlTypes.selectionSet([
                gqlTypes.field(
                    gqlTypes.name(queryType.name),
                    gqlTypes.name('data'),
                    args,
                    null,
                    gqlTypes.selectionSet(fields)
                ),
            ]),
            gqlTypes.name(queryType.name),
            apolloArgs
        ),
    ]);
};

export const buildFields = (
    introspectionResults: IntrospectionResult,
    paths = []
) => (fields: readonly IntrospectionField[], sparseFields?: RequestedFields, extraFields?: RequestedFields) => {
    const { fields: requestedFields, linkedRequestedFields } = processRequestedFields(
        fields,
        sparseFields,
        extraFields
    );

    return requestedFields.reduce((acc, field) => {
        const type = getFinalType(field.type);

        if (type.name.startsWith('_')) {
            return acc;
        }

        if (type.kind !== TypeKind.OBJECT && type.kind !== TypeKind.INTERFACE) {
            return [...acc, gqlTypes.field(gqlTypes.name(field.name))];
        }

        const linkedResource = introspectionResults.resources.find(
            r => r.type.name === type.name
        );

        if (linkedResource) {
            // NOTE: linkedResource fields will always be sparse fields (even if defined as extra)
            // because the default is only ID fields
            const linkedResourceSparseFields = linkedRequestedFields.find(
                lSP => lSP.linkedType == field.name
            )?.fields || ['id']; // default to id if no sparse fields specified for linked resource

            const linkedResourceFields = buildFields(introspectionResults)(
                linkedResource.type.fields,
                linkedResourceSparseFields
            );

            return [
                ...acc,
                gqlTypes.field(
                    gqlTypes.name(field.name),
                    null,
                    null,
                    null,
                    gqlTypes.selectionSet(linkedResourceFields)
                ),
            ];
        }

        const linkedType = introspectionResults.types.find(
            t => t.name === type.name
        );

        if (linkedType && !paths.includes(linkedType.name)) {
            const possibleTypes =
                (linkedType as IntrospectionUnionType).possibleTypes || [];

            return [
                ...acc,
                gqlTypes.field(
                    gqlTypes.name(field.name),
                    null,
                    null,
                    null,
                    gqlTypes.selectionSet([
                        ...buildFragments(introspectionResults)(possibleTypes),
                        ...buildFields(introspectionResults, [
                            ...paths,
                            linkedType.name,
                        ])(
                            (linkedType as IntrospectionObjectType).fields,
                            linkedRequestedFields.find(
                                lSP => lSP.linkedType == field.name
                            )?.fields // NOTE: treat requested fields always as sparse fields for linkedType (treat same as linkedResource)
                        ),
                    ])
                ),
            ];
        }

        // NOTE: We might have to handle linked types which are not resources but will have to be careful about
        // ending with endless circular dependencies
        return acc;
    }, []);
};

export const buildFragments = (introspectionResults: IntrospectionResult) => (
    possibleTypes: readonly IntrospectionNamedTypeRef<IntrospectionObjectType>[]
) =>
    possibleTypes.reduce((acc, possibleType) => {
        const type = getFinalType(possibleType);

        const linkedType = introspectionResults.types.find(
            t => t.name === type.name
        );

        return [
            ...acc,
            gqlTypes.inlineFragment(
                gqlTypes.selectionSet(
                    buildFields(introspectionResults)(
                        (linkedType as IntrospectionObjectType).fields
                    )
                ),
                gqlTypes.namedType(gqlTypes.name(type.name))
            ),
        ];
    }, []);

export const buildArgs = (
    query: IntrospectionField,
    variables: any,
    fieldNameConvention: FieldNameConventionEnum = FieldNameConventionEnum.CAMEL
): ArgumentNode[] => {
    if (query.args.length === 0) {
        return [];
    }

    const validVariables = Object.keys(variables).filter(
        k => typeof variables[k] !== 'undefined'
    );
    let args = query.args
        .filter(
            a =>
                validVariables.includes(a.name) ||
                validVariables.includes(
                    FieldNameConventions[fieldNameConvention].strWithConvention(
                        a.name
                    )
                )
        )
        .reduce(
            (acc, arg) => [
                ...acc,
                gqlTypes.argument(
                    gqlTypes.name(arg.name),
                    gqlTypes.variable(gqlTypes.name(arg.name))
                ),
            ],
            []
        );

    return args;
};

export const buildApolloArgs = (
    query: IntrospectionField,
    variables: any,
    fieldNameConvention: FieldNameConventionEnum = FieldNameConventionEnum.CAMEL
): VariableDefinitionNode[] => {
    if (query.args.length === 0) {
        return [];
    }

    const validVariables = Object.keys(variables).filter(
        k => typeof variables[k] !== 'undefined'
    );

    let args = query.args
        .filter(
            a =>
                validVariables.includes(a.name) ||
                validVariables.includes(
                    FieldNameConventions[fieldNameConvention].strWithConvention(
                        a.name
                    )
                )
        )
        .reduce((acc, arg) => {
            return [
                ...acc,
                gqlTypes.variableDefinition(
                    gqlTypes.variable(gqlTypes.name(arg.name)),
                    getGqlType(arg.type)
                ),
            ];
        }, []);

    return args;
};
