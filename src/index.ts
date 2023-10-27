import merge from 'lodash/merge';
import buildDataProvider, {
    BuildQueryFactory,
    Options,
    introspectSchema,
    IntrospectionOptions,
    IntrospectionResult,
} from 'ra-data-graphql';
import {
    DataProvider,
    Identifier,
    DELETE_MANY,
    GET_LIST,
    GET_ONE,
    GET_MANY,
    GET_MANY_REFERENCE,
    CREATE,
    UPDATE,
    DELETE,
    UPDATE_MANY,
} from 'ra-core';
import pluralize from 'pluralize';

import defaultBuildQuery from './buildQuery';
import {
    FieldNameConventions,
    FieldNameConventionEnum,
} from './fieldNameConventions';

import { DataProviderExtension, DataProviderExtensions } from './extensions';

export { FieldNameConventionEnum };

export const buildQuery = defaultBuildQuery;
export { buildQueryFactory } from './buildQuery';
export { default as buildGqlQuery } from './buildGqlQuery';
export { default as buildVariables } from './buildVariables';
export { default as getResponseParser } from './getResponseParser';

const buildIntrospection = (
    fieldNameConvention: FieldNameConventionEnum = FieldNameConventionEnum.CAMEL
) => {
    const introspection = {
        operationNames: {
            [GET_LIST]: resource =>
                FieldNameConventions[fieldNameConvention].resourceActionToField[GET_LIST](resource),
            [GET_ONE]: resource =>
                FieldNameConventions[fieldNameConvention].resourceActionToField[GET_ONE](resource),
            [GET_MANY]: resource =>
                FieldNameConventions[fieldNameConvention].resourceActionToField[GET_MANY](resource),
            [GET_MANY_REFERENCE]: resource =>
                FieldNameConventions[fieldNameConvention].resourceActionToField[GET_MANY_REFERENCE](
                    resource
                ),
            [CREATE]: resource =>
                FieldNameConventions[fieldNameConvention].resourceActionToField[CREATE](resource),
            [UPDATE]: resource =>
                FieldNameConventions[fieldNameConvention].resourceActionToField[UPDATE](resource),
            [DELETE]: resource =>
                FieldNameConventions[fieldNameConvention].resourceActionToField[DELETE](resource),
            [DELETE_MANY]: resource =>
                FieldNameConventions[fieldNameConvention].resourceActionToField[DELETE_MANY](
                    resource
                ),
            [UPDATE_MANY]: resource =>
                FieldNameConventions[fieldNameConvention].resourceActionToField[UPDATE_MANY](
                    resource
                ),
        },
        exclude: undefined,
        include: undefined,
    };

    return introspection;
};

const baseDefaultOptions = {
    resolveIntrospection: introspectSchema,
    introspection: {
        operationNames: {
            [GET_LIST]: resource => `all${pluralize(resource.name)}`,
            [GET_ONE]: resource => `${resource.name}`,
            [GET_MANY]: resource => `all${pluralize(resource.name)}`,
            [GET_MANY_REFERENCE]: resource => `all${pluralize(resource.name)}`,
            [CREATE]: resource => `create${resource.name}`,
            [UPDATE]: resource => `update${resource.name}`,
            [DELETE]: resource => `delete${resource.name}`,
        },
        exclude: undefined,
        include: undefined,
    },
};

export {
    introspectSchema,
    IntrospectionOptions,
    buildIntrospection,
    DataProviderExtensions,
};

export type DataProviderOptions = Omit<Options, 'buildQuery'> & {
    buildQuery?: BuildQueryFactory;
    bulkActionsEnabled?: boolean;
    extensions?: DataProviderExtension[];
    fieldNameConvention?: FieldNameConventionEnum;
    resolveIntrospection?: typeof introspectSchema;
};

export default (options: DataProviderOptions = {}): Promise<DataProvider> => {
    console.log('root options', options)
    const {
        bulkActionsEnabled = false,
        extensions = [],
        fieldNameConvention = FieldNameConventionEnum.CAMEL,
        ...customOptions
    } = options;
    console.log('root fieldNameConvention', fieldNameConvention)

    const defaultOptions = {
        ...baseDefaultOptions,
        buildQuery: (introspectionResults: IntrospectionResult) =>
            defaultBuildQuery(introspectionResults, fieldNameConvention),
        introspection: buildIntrospection(fieldNameConvention),
    };

    const dPOptions = merge({}, defaultOptions, customOptions);

    if (dPOptions.introspection?.operationNames) {
        let operationNames = dPOptions.introspection.operationNames;

        extensions.forEach(({ introspectionOperationNames }) => {
            if (introspectionOperationNames)
                operationNames = merge(
                    operationNames,
                    introspectionOperationNames
                );
        });

        dPOptions.introspection.operationNames = operationNames;
    }

    return buildDataProvider(dPOptions).then(defaultDataProvider => {
        return {
            ...defaultDataProvider,
            // This provider defaults to sending multiple DELETE requests for DELETE_MANY
            // and multiple UPDATE requests for UPDATE_MANY unless bulk actions are enabled
            // This can be optimized using the apollo-link-batch-http link
            ...(bulkActionsEnabled
                ? {}
                : {
                      deleteMany: (resource, params) => {
                          const { ids, ...otherParams } = params;
                          return Promise.all(
                              ids.map(id =>
                                  defaultDataProvider.delete(resource, {
                                      id,
                                      previousData: null,
                                      ...otherParams,
                                  })
                              )
                          ).then(results => {
                              const data = results.reduce<Identifier[]>(
                                  (acc, { data }) => [...acc, data.id],
                                  []
                              );

                              return { data };
                          });
                      },
                      updateMany: (resource, params) => {
                          const { ids, data, ...otherParams } = params;
                          return Promise.all(
                              ids.map(id =>
                                  defaultDataProvider.update(resource, {
                                      id,
                                      data: data,
                                      previousData: null,
                                      ...otherParams,
                                  })
                              )
                          ).then(results => {
                              const data = results.reduce<Identifier[]>(
                                  (acc, { data }) => [...acc, data.id],
                                  []
                              );

                              return { data };
                          });
                      },
                  }),
            ...extensions.reduce(
                (acc, { methodFactory, factoryArgs = [] }) => ({
                    ...acc,
                    ...(factoryArgs.length > 0 ? methodFactory(defaultDataProvider, ...factoryArgs) : methodFactory(defaultDataProvider))
                }),
                {}
            ),
        };
    });
};
