import { OperationDefinitionNode, valueFromASTUntyped } from "graphql";

// This function checks if "partialArguments" is contained in "args" (taking into
// consideration null/undefined equivalency) :
export function isPartialMatch(
  partialArguments: Record<string, any>,
  args: Record<string, any>
) {
  return Object.entries(partialArguments).every(
    ([key, value]) => (value ?? null) === (args[key] ?? null)
  );
}

// Checks if an operation definition is a live query :
export function isLiveOperation(operation: OperationDefinitionNode) {
  return Boolean(
    operation.operation === "query" &&
      operation.directives?.find(({ name }) => name.value === "live")
  );
}

// This function extracts field names and arguments given an operation and a set of variables :
export function getFieldRecords(
  operation: OperationDefinitionNode,
  variables?: Record<string, any>
) {
  const fields = new Map<string, Record<string, any>>();
  for (const selection of operation.selectionSet.selections) {
    if (selection.kind === "Field") {
      const args: Record<string, any> = Object.create(null);
      for (const arg of selection.arguments ?? [])
        args[arg.name.value] = valueFromASTUntyped(arg.value, variables);
      fields.set(selection.name.value, args);
    }
  }
  return fields;
}
