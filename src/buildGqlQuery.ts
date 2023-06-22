import { GET_LIST, GET_MANY, GET_MANY_REFERENCE, DELETE } from 'ra-core';
import {
    QUERY_TYPES,
    IntrospectionResult,
    IntrospectedResource,
} from 'ra-data-graphql';
import {
    ArgumentNode,
    IntrospectionField,
    IntrospectionInputValue,
    IntrospectionNamedTypeRef,
    IntrospectionObjectType,
    IntrospectionUnionType,
    TypeKind,
    TypeNode,
    VariableDefinitionNode,
} from 'graphql';
import * as gqlTypes from 'graphql-ast-types-browser';

import getFinalType from './getFinalType';
import isList from './isList';
import isRequired from './isRequired';
import { snakeToCamel } from './inflection'

const defaultFieldsResolutionTypes = [TypeKind.SCALAR] // unless sparse fields are specified, default fields requested in queries / mutations will be scalars only

function getType(fieldType) {
    if (fieldType.ofType == null) return fieldType.kind

    return getType(fieldType.ofType)
}

function processRequestedFields(availFields, attrs) {
    const resourceAttrs = attrs.filter(attr => !attr.includes('.'))
    const associationAttrs = attrs.filter(attr => !resourceAttrs.includes(attr))
    // naive association parsing. only one level deep for now
    const associations = [...new Set(associationAttrs.map(f => f.split('.')[0]))] as string[]

    let fields = availFields.filter(f => resourceAttrs.includes(f.name) || associations.includes(f.name))

    const associationFields = {}
    associations.forEach(association => {
        associationFields[association] = associationAttrs.filter(attr => attr.startsWith(association)).map(attr => attr.split('.')[1])
    })

    return { fields, associationFields }
}

export default (introspectionResults: IntrospectionResult) => (
    resource: IntrospectedResource,
    raFetchMethod: string,
    queryType: IntrospectionField,
    variables: any
) => {
    const { sortField, sortOrder, ...metaVariables } = variables;
    const apolloArgs = buildApolloArgs(queryType, variables);
    const args = buildArgs(queryType, variables);
    const metaArgs = buildArgs(queryType, metaVariables);

    let resourceFields = resource.type.fields.filter(field => defaultFieldsResolutionTypes.includes(getType(field.type)))

    let fields;

    if (variables.extra_fields || variables.sparse_fields){
        const { fields: requestedFields, associationFields } = processRequestedFields(resource.type.fields, variables.extra_fields || variables.sparse_fields)
        if (variables.extra_fields) resourceFields = [...resourceFields, ...requestedFields]
        else resourceFields = requestedFields // sparse fields overrides

        fields = buildFields(introspectionResults)(resourceFields, associationFields);
    } else fields = buildFields(introspectionResults)(resourceFields);

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
                        gqlTypes.name(`_${queryType.name}Meta`),
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
) => (fields, associationFields = null) =>
    fields.reduce((acc, field) => {
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
            const linkedResourceFields = associationFields ? buildFields(introspectionResults)(linkedResource.type.fields.filter(f => associationFields[field.name].includes(f.name))) : buildFields(introspectionResults)(linkedResource.type.fields)
            return [
                ...acc,
                gqlTypes.field(
                    gqlTypes.name(field.name),
                    null,
                    null,
                    null,
                    // gqlTypes.selectionSet([gqlTypes.field(gqlTypes.name('id'))])
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
                        ])((linkedType as IntrospectionObjectType).fields),
                    ])
                ),
            ];
        }

        // NOTE: We might have to handle linked types which are not resources but will have to be careful about
        // ending with endless circular dependencies
        return acc;
    }, []);

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
    variables: any
): ArgumentNode[] => {
    if (query.args.length === 0) {
        return [];
    }

    const validVariables = Object.keys(variables).filter(
        k => typeof variables[k] !== 'undefined'
    );
    let args = query.args
        .filter(a => validVariables.includes(a.name) || validVariables.includes(snakeToCamel(a.name)))
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
    variables: any
): VariableDefinitionNode[] => {
    if (query.args.length === 0) {
        return [];
    }

    const validVariables = Object.keys(variables).filter(
        k => typeof variables[k] !== 'undefined'
    );

    let args = query.args
        .filter(a => validVariables.includes(a.name) || validVariables.includes(snakeToCamel(a.name)))
        .reduce((acc, arg) => {
            return [
                ...acc,
                gqlTypes.variableDefinition(
                    gqlTypes.variable(gqlTypes.name(arg.name)),
                    getArgType(arg)
                ),
            ];
        }, []);

    return args;
};

export const getArgType = (arg: IntrospectionInputValue): TypeNode => {
    const type = getFinalType(arg.type);
    const required = isRequired(arg.type);
    const list = isList(arg.type);

    if (list) {
        if (required) {
            return gqlTypes.listType(
                gqlTypes.nonNullType(
                    gqlTypes.namedType(gqlTypes.name(type.name))
                )
            );
        }
        return gqlTypes.listType(gqlTypes.namedType(gqlTypes.name(type.name)));
    }

    if (required) {
        return gqlTypes.nonNullType(
            gqlTypes.namedType(gqlTypes.name(type.name))
        );
    }

    return gqlTypes.namedType(gqlTypes.name(type.name));
};
