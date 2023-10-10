import merge from 'lodash/merge';
import buildDataProvider, { BuildQueryFactory, Options, introspectSchema, IntrospectionOptions } from 'ra-data-graphql';
import { DataProvider, Identifier, GET_LIST, GET_ONE, GET_MANY, GET_MANY_REFERENCE, CREATE, UPDATE, DELETE, DELETE_MANY } from 'ra-core';
import pluralize from 'pluralize';

import defaultBuildQuery from './buildQuery';

const defaultIntrospection = {
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
}

const defaultOptions = {
    buildQuery: defaultBuildQuery,
    introspection: defaultIntrospection,
    // defaultFieldsResolutionTypes: [TypeKind.SCALAR] // TODO ideally this is parametric, but this will require modifications to the underlying ra-data-graphql buildDataProvider 
};

export { introspectSchema, IntrospectionOptions, defaultIntrospection }

export const buildQuery = defaultBuildQuery;

export default (
    options: Omit<Options, 'buildQuery'> & { buildQuery?: BuildQueryFactory; dataProviderExtensions?: any, resolveIntrospection?: typeof introspectSchema }
): Promise<DataProvider> => {
    const { dataProviderExtensions, ...customOptions } = options;
    return buildDataProvider(merge({}, defaultOptions, customOptions)).then(
        defaultDataProvider => {
            return {
                ...defaultDataProvider,
                // // This provider does not support multiple deletions so instead we send multiple DELETE requests
                // // This can be optimized using the apollo-link-batch-http link
                // deleteMany: (resource, params) => {
                //     const { ids, ...otherParams } = params;
                //     return Promise.all(
                //         ids.map(id =>
                //             defaultDataProvider.delete(resource, {
                //                 id,
                //                 previousData: null,
                //                 ...otherParams,
                //             })
                //         )
                //     ).then(results => {
                //         const data = results.reduce<Identifier[]>(
                //             (acc, { data }) => [...acc, data.id],
                //             []
                //         );

                //         return { data };
                //     });
                // },
                // This provider does not support multiple updates so instead we send multiple UPDATE requests
                // This can be optimized using the apollo-link-batch-http link
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
                ...(dataProviderExtensions || {})
            };
        }
    );
};
