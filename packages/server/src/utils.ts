import { OperationDefinitionNode, valueFromASTUntyped } from "graphql";
import { RootFieldRecord } from ".";

export function isContained(
  contained: Record<string, any>,
  container: Record<string, any>
) {
  return Object.entries(contained).every(
    ([key, value]) => (value ?? null) === (container[key] ?? null)
  );
}

export function isLiveOperation(operation: OperationDefinitionNode) {
  return Boolean(
    operation.operation === "query" &&
      operation.directives?.find(({ name }) => name.value === "live")
  );
}

export function getRootFieldRecords(
  operation: OperationDefinitionNode,
  variables?: Record<string, any>
) {
  const fields: Array<RootFieldRecord> = [];
  for (const selection of operation.selectionSet.selections) {
    if (selection.kind === "Field") {
      const args: Record<string, any> = {};
      for (const arg of selection.arguments ?? [])
        args[arg.name.value] = valueFromASTUntyped(arg.value, variables);
      fields.push({
        name: selection.name.value,
        arguments: args
      });
    }
  }
  return fields;
}
