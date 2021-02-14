import { Operation, subscriptionExchange } from "urql";
import { ClientOptions, createClient } from ".";

export function liveExchange(options: ClientOptions) {
  const client = createClient(options);
  return subscriptionExchange({
    enableAllOperations: true,
    forwardSubscription: operation => ({
      subscribe: observer => ({
        unsubscribe: client.execute(observer, {
          operation: operation.query,
          variables: operation.variables
        })
      })
    })
  });
}
