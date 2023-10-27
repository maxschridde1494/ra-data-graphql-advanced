import { DataProvider } from 'ra-core';
import { IntrospectionOptions } from 'ra-data-graphql';

import { RealtimeExtension } from './realtime';
import { FieldNameConventionEnum } from '../fieldNameConventions';

type DataProviderMethod = (...args: any[]) => Promise<{ data: any }>;

type MethodFactoryArgs = {
    dataProvider: DataProvider;
    [k: string]: any;
}

export type DataProviderExtension = {
    methodFactory: (params: MethodFactoryArgs) => { [k: string]: DataProviderMethod };
    factoryArgs?: {[k: string]: any};
    introspectionOperationNamesFactory?: (fieldNameConvention: FieldNameConventionEnum) => IntrospectionOptions['operationNames'];
};

export class DataProviderExtensions {
    static Realtime = RealtimeExtension;
}
