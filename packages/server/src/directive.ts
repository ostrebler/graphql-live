import { DirectiveLocation, GraphQLDirective } from "graphql";

export const GraphQLLiveDirective = new GraphQLDirective({
  name: "live",
  description: "Instruction for establishing a live connection.",
  locations: [DirectiveLocation.QUERY]
});
