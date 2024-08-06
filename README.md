# hono-router

`hono-router` is a TypeScript script that generates a file-based router for [Hono](https://hono.dev/), a small, simple, and ultrafast web framework for the Edges. It automatically creates routes based on your file structure and exports, making it easier to organize and maintain your Hono application.

## Features

- Automatically generates routes based on your file structure
- Supports dynamic routes (e.g., `[id].ts` becomes `:id` in the route)
- Allows co-location of component files with routes
- Watches for file changes and regenerates the router
- Sorts routes to prioritize static paths over dynamic paths
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
bunx hono-router src/routes router.ts
```

or

```bash
npx hono-router src/routes router.ts
```

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

The script automatically watches for changes in your routes directory and regenerates the router file when changes are detected.

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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.
