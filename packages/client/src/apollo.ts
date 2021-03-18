import {
  ApolloLink,
  FetchResult,
  Observable,
  Observer,
  Operation
} from "@apollo/client";
import { print } from "graphql";
import { ClientOptions, createClient } from ".";

export class LiveLink<TContext = any> extends ApolloLink {
  private client: ReturnType<typeof createClient>;

  constructor(options: ClientOptions<TContext>) {
    super();
    this.client = createClient(options);
  }

  request(operation: Operation) {
    return new Observable<FetchResult>((observer: Observer<FetchResult>) =>
      this.client.execute(
        {
          operation: print(operation.query),
          operationName: operation.operationName,
          variables: operation.variables
        },
        observer
      )
    );
  }
}
