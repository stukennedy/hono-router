# hono-router

`hono-router` is a script that generates a file-based router for [Hono](https://hono.dev/), a small, simple, and ultrafast web framework for the Edges. It automatically creates routes based on your file structure and exports, making it easier to organize and maintain your Hono application.

## Features

- Automatically generates routes based on your file structure
- Supports dynamic routes (e.g., `[id].ts` becomes `:id` in the route)
- Supports greedy/catch-all routes (e.g., `[[blob]].ts` for one or more segments, `[...rest].ts` for zero or more)
- Allows co-location of component files with routes
- Optional watch mode for automatic regeneration on file changes
- Intelligent route sorting: static paths > dynamic paths > greedy paths
- Supports multiple HTTP methods (GET, PUT, POST, DELETE, PATCH)
- Can be run with [Bun](https://bun.sh/) for fast execution

## Installation

```bash
npm install hono-router
```

## Usage

1. Create a directory structure for your routes and components. For example:

```
src/
  routes/
    index.ts
    users/
      index.ts
      [id].ts
      UserList.tsx
    posts/
      index.ts
      [id].ts
      PostEditor.tsx
    docs/
      [...slug].ts        # Catch-all route (zero or more segments)
    api/
      [[...path]].ts      # Greedy route (one or more segments)
```

2. In your route files, export functions for the HTTP methods you want to handle. For example, in `src/routes/users/[id].ts`:

```typescript
import { Context } from 'hono';

export const onRequestGet = (c: Context) => {
	const id = c.req.param('id');
	return c.json({ message: `Get user ${id}` });
};

export const onRequestPut = (c: Context) => {
	const id = c.req.param('id');
	return c.json({ message: `Update user ${id}` });
};
```

3. Run the router generator script:

```bash
bunx hono-router src/routes router.ts [options]
```

or

```bash
npx hono-router src/routes router.ts [options]
```

**Options:**
- `--watch` or `-w`: Enable watch mode to automatically regenerate routes on file changes
- `--deno`: Generate Deno-compatible imports

This will generate a `router.ts` file with all your routes.

4. In your main Hono app file, import and use the generated router:

```typescript
import { Hono } from 'hono';
import { loadRoutes } from './router';

const app = new Hono();
loadRoutes(app);

export default app;
```

## Component Integration

`hono-router` allows you to co-locate component files with your routes. Any TypeScript or TypeScript JSX (`.tsx`) files that start with a capital letter are ignored by the router generation process. This enables you to keep your components close to the routes that use them without affecting the routing logic.

For example:

- `src/routes/users/UserList.tsx` will be ignored by the router
- `src/routes/users/index.ts` will be processed for route generation

This feature helps in maintaining a clean and organized project structure where components and their associated routes are kept together.

## Watch Mode

To enable watch mode, use the `--watch` or `-w` flag when running the script:

```bash
npx hono-router src/routes router.ts --watch
```

In watch mode, the script will continuously monitor your routes directory and automatically regenerate the router file when changes are detected.

## Supported HTTP Methods

The generator supports the following HTTP methods:

- GET
- PUT
- POST
- DELETE
- PATCH

To use these methods, export functions with the corresponding names in your route files:

- `onRequestGet`
- `onRequestPut`
- `onRequestPost`
- `onRequestDelete`
- `onRequestPatch`

## Dynamic and Greedy Routes

### Dynamic Routes
Standard dynamic routes match a single path segment:
- File: `[id].ts` → Route: `:id`
- Example: `/users/[id].ts` matches `/users/123` but not `/users/123/posts`

### Greedy Routes
Greedy routes can match multiple path segments:

#### Double-bracket syntax `[[param]]` (one or more segments)
- File: `[[path]].ts` → Route: `:path{.+}`
- Example: `/api/[[path]].ts` matches `/api/v1`, `/api/v1/users`, etc.
- Does NOT match: `/api` (requires at least one segment)

#### Spread syntax `[...param]` (zero or more segments)
- File: `[...slug].ts` → Route: `:slug{.*}`
- Example: `/docs/[...slug].ts` matches `/docs`, `/docs/intro`, `/docs/guides/setup`, etc.

### Route Priority
Routes are automatically sorted to ensure correct matching:
1. **Static routes** (e.g., `/api/users`) - highest priority
2. **Dynamic routes** (e.g., `/api/:id`) - medium priority
3. **Greedy routes** (e.g., `/api/:path{.+}`) - lowest priority

This ensures that more specific routes are always matched before catch-all routes.

### Example Use Cases

#### API Proxy
```typescript
// routes/proxy/[[...path]].ts
export const onRequestGet = async (c: Context) => {
  const path = c.req.param('path');
  // Forward request to backend API
  return fetch(`https://backend.api/${path}`);
};
```

#### Documentation Catch-All
```typescript
// routes/docs/[...slug].ts
export const onRequestGet = (c: Context) => {
  const slug = c.req.param('slug') || 'index';
  // Serve documentation page based on slug
  return c.html(renderDocsPage(slug));
};
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.
