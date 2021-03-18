import { subscriptionExchange } from "urql";
import { ClientOptions, createClient } from ".";

export function liveExchange<TContext = any>(options: ClientOptions<TContext>) {
  const { execute } = createClient(options);
  return subscriptionExchange({
    enableAllOperations: true,
    forwardSubscription: operation => ({
      subscribe: observer => ({
        unsubscribe: execute(
          {
            operation: operation.query,
            variables: operation.variables
          },
          observer
        )
      })
    })
  });
}
