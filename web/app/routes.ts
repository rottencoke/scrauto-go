import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  layout("routes/scores-layout.tsx", [
    route("scores", "routes/scores._index.tsx"),
    route("scores/new", "routes/scores.new.tsx"),
    route("scores/:id", "routes/scores.$id.tsx"),
  ]),
] satisfies RouteConfig;
