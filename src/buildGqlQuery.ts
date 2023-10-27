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

type SparseFields = (string | { [k: string]: SparseFields })[];
type ExpandedSparseFields = { linkedType?: string; fields: SparseFields }[];

function getType(fieldType) {
    if (fieldType.ofType == null) return fieldType.kind;

    return getType(fieldType.ofType);
}

function processSparseFields(
    resourceFields: readonly IntrospectionField[],
    sparseFields: SparseFields
): {
    fields: readonly IntrospectionField[];
    linkedSparseFields: ExpandedSparseFields;
} {
    if (!sparseFields || sparseFields.length == 0)
        return {
            fields: resourceFields.filter(field =>
                defaultFieldsResolutionTypes.includes(getType(field.type))
            ),
            linkedSparseFields: [],
        }; // default (which is scalar resource fields) if sparse fields not specified

    const resourceFNames = resourceFields.map(f => f.name);

    const expandedSparseFields: ExpandedSparseFields = sparseFields.map(sP => {
        if (typeof sP == 'string') return { fields: [sP] };

        const [linkedType, linkedSparseFields] = Object.entries(sP)[0];

        return { linkedType, fields: linkedSparseFields };
    });

    const permittedSparseFields = expandedSparseFields.filter(sF =>
        resourceFNames.includes((sF.linkedType || sF.fields[0]) as string)
    ); // ensure the requested fields are available

    const sparseFNames = permittedSparseFields.map(
        sF => sF.linkedType || sF.fields[0]
    );

    const fields = resourceFields.filter(rF => sparseFNames.includes(rF.name));
    const linkedSparseFields = permittedSparseFields.filter(
        sF => !!sF.linkedType
    ); // sparse fields to be used for linked resources / types

    return { fields, linkedSparseFields };
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
    const sparseFields = metaVariables.meta?.sparseFields;
    if (sparseFields) delete metaVariables.meta.sparseFields;

    const fields = buildFields(introspectionResults)(
        resource.type.fields,
        sparseFields
    );
    const apolloArgs = buildApolloArgs(
        queryType,
        variables,
        fieldNameConvention
    );
    const args = buildArgs(queryType, variables, fieldNameConvention);
    const metaArgs = buildArgs(queryType, metaVariables, fieldNameConvention);
    
    console.log('buildGqlQuery fieldNameConvention', fieldNameConvention)

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
) => (fields: readonly IntrospectionField[], sparseFields?: SparseFields) => {
    const { fields: requestedFields, linkedSparseFields } = processSparseFields(
        fields,
        sparseFields
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
            const linkedResourceSparseFields = linkedSparseFields.find(
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
                            linkedSparseFields.find(
                                lSP => lSP.linkedType == field.name
                            )?.fields
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
