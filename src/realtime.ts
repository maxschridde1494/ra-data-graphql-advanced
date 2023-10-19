import { ApolloClient, OperationVariables, SubscriptionOptions, gql } from "@apollo/client";
import { FieldNamingConventions, resourceNameWithNameConvention } from '.'
import pluralize from "pluralize";

let subscriptions: {topic: string; subscription: any; subscriptionCallback: any }[] = [];

// Below is based off @react-admin/ra-realtime expectations

const topicToGQLSubscribe = (topic: string, fieldNamingConvention: FieldNamingConventions): SubscriptionOptions<OperationVariables, any> & { queryName: string } => {
  // Two possible topic patterns (from react admin)
  //    1. resource/${resource}
  //    2. resource/${resource}/${id}

  let raCRUDTopic = topic.startsWith('resource/') ? topic.split('/') : null 

  // TODO handle non crud topics
  if (!raCRUDTopic) return ({ query: gql``, queryName: '', variables: {}})

  let query;
  let variables = {}
  let queryName

  if (raCRUDTopic.length === 2) {
    // list subscription

    queryName = `all${pluralize(resourceNameWithNameConvention(raCRUDTopic[1], fieldNamingConvention))}`

    query = gql`
      subscription ${queryName} {
        ${queryName}{
          topic
          event
        }
      }
    `
  } else {
    // single resource subscription

    queryName = `${raCRUDTopic[1]}`
    query = gql`
      subscription ${queryName}($id: String!) {
        ${queryName}(id: $id){
          topic
          event
        }
      }
    `

    variables = { id: raCRUDTopic[2] }
  }
  
  return ({
    query,
    variables,
    queryName
  })
}

export const buildRealtimeDataProviderMethods = (client: ApolloClient<unknown>, fieldNamingConvention: FieldNamingConventions) => {
  return {
    subscribe: async (topic: string, subscriptionCallback: any) => {
      const { queryName, ...subscribeOptions } = topicToGQLSubscribe(topic, fieldNamingConvention)
      const subscription = client.subscribe(subscribeOptions).subscribe((data) => subscriptionCallback(data.data[queryName].event));
  
      subscriptions.push({ topic, subscription, subscriptionCallback })
      return Promise.resolve({ data: null });
    },
  
    unsubscribe: async (topic: string, subscriptionCallback: any) => {
      const indexOfSubscription = subscriptions.findIndex(s => s.topic === topic && s.subscriptionCallback === subscriptionCallback)
      const { subscription} = subscriptions.splice(indexOfSubscription, 1)[0]
      
      if (subscription) subscription.unsubscribe();
    
      return Promise.resolve({ data: null });
    },
  }
}