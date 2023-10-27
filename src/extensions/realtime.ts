import { OperationVariables, SubscriptionOptions, gql } from '@apollo/client';

import { DataProviderExtension } from '.';
import { DataProvider } from 'ra-core';
import { FieldNameConventions, FieldNameConventionEnum } from '../fieldNameConventions';

// Below is based off @react-admin/ra-realtime expectations

export const SUBSCRIBE_LIST = 'SUBSCRIBE_LIST';
export const SUBSCRIBE_ONE = 'SUBSCRIBE_ONE';

const introspectionOperationNamesFactory = (fieldNameConvention: FieldNameConventionEnum = FieldNameConventionEnum.CAMEL) => ({
    [SUBSCRIBE_LIST]: resource =>
                FieldNameConventions[fieldNameConvention].resourceActionToField[SUBSCRIBE_LIST](resource),
    [SUBSCRIBE_ONE]: resource =>
        FieldNameConventions[fieldNameConvention].resourceActionToField[SUBSCRIBE_ONE](resource),
});

export const topicToGQLSubscribe = (
    topic: string,
    fieldNameConvention: FieldNameConventionEnum = FieldNameConventionEnum.CAMEL
): SubscriptionOptions<OperationVariables, any> & { queryName: string } => {
    // Two possible topic patterns (from react admin)
    //    1. resource/${resource}
    //    2. resource/${resource}/${id}

    let raCRUDTopic = topic.startsWith('resource/') ? topic.split('/') : null;

    // TODO handle non crud topics
    if (!raCRUDTopic) return { query: gql``, queryName: '', variables: {} };

    let query;
    let variables = {};
    let queryName;
    const resource = raCRUDTopic[1];

    if (raCRUDTopic.length === 2) {
        // list subscription

        queryName = FieldNameConventions[fieldNameConvention].resourceActionToField[SUBSCRIBE_LIST]({ name: resource});

        query = gql`
      subscription ${queryName} {
        ${queryName}{
          topic
          event
        }
      }
    `;
    } else {
        // single resource subscription
        queryName = FieldNameConventions[fieldNameConvention].resourceActionToField[SUBSCRIBE_ONE]({ name: resource});

        query = gql`
      subscription ${queryName}($id: ID!) {
        ${queryName}(id: $id){
          topic
          event
        }
      }
    `;

        variables = { id: raCRUDTopic[2] };
    }

    return {
        query,
        variables,
        queryName,
    };
};

type Subscription = {
    topic: string;
    subscription: any;
    subscriptionCallback: any;
};

const methodFactory = ({
    dataProvider,
    client,
    fieldNameConvention = FieldNameConventionEnum.CAMEL,
    subscriptionStore = []
}: {
    dataProvider: DataProvider,
    client?: any,
    fieldNameConvention?: FieldNameConventionEnum,
    subscriptionStore?: Subscription[]
}) => {
    return {
        subscribe: async (topic: string, subscriptionCallback: any) => {
            const { queryName, ...subscribeOptions } = topicToGQLSubscribe(
                topic,
                fieldNameConvention
            );
            const subscription = (client || dataProvider.client)
                .subscribe(subscribeOptions)
                .subscribe(data =>
                    subscriptionCallback(data.data[queryName].event)
                );

            subscriptionStore.push({
                topic,
                subscription,
                subscriptionCallback,
            });
            return Promise.resolve({ data: null });
        },

        unsubscribe: async (topic: string, subscriptionCallback: any) => {
            const indexOfSubscription = subscriptionStore.findIndex(
                s =>
                    s.topic === topic &&
                    s.subscriptionCallback === subscriptionCallback
            );
            const { subscription } = subscriptionStore.splice(
                indexOfSubscription,
                1
            )[0];

            if (subscription) subscription.unsubscribe();

            return Promise.resolve({ data: null });
        },
    };
};

export const RealtimeExtension: DataProviderExtension = {
    methodFactory,
    introspectionOperationNamesFactory,
};
