const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

// Helper to create temporary test directories
const createTempDir = () => {
	const tempDir = path.join(__dirname, 'test-temp-' + Date.now());
	fs.mkdirSync(tempDir, { recursive: true });
	return tempDir;
};

// Helper to clean up test directories
const cleanupDir = (dir) => {
	if (fs.existsSync(dir)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
};

// Helper to run the CLI
const runCLI = (args) => {
	return new Promise((resolve, reject) => {
		const child = spawn('node', [path.join(__dirname, 'index.js'), ...args]);
		let stdout = '';
		let stderr = '';
		
		child.stdout.on('data', (data) => {
			stdout += data.toString();
		});
		
		child.stderr.on('data', (data) => {
			stderr += data.toString();
		});
		
		child.on('close', (code) => {
			resolve({ code, stdout, stderr });
		});
		
		// Kill watch mode after a short delay
		if (args.includes('--watch') || args.includes('-w')) {
			setTimeout(() => child.kill(), 1000);
		}
	});
};

describe('hono-router tests', () => {
	let tempDir;
	let routesDir;
	let outputFile;
	
	beforeEach(() => {
		tempDir = createTempDir();
		routesDir = path.join(tempDir, 'routes');
		outputFile = path.join(tempDir, 'router.ts');
		fs.mkdirSync(routesDir, { recursive: true });
	});
	
	afterEach(() => {
		cleanupDir(tempDir);
	});
	
	describe('Core functionality', () => {
		it('should generate routes for simple GET endpoint', async () => {
			// Create a simple route file
			const routeContent = `
export const onRequestGet = (c) => {
	return c.json({ message: 'Hello' });
};`;
			fs.writeFileSync(path.join(routesDir, 'index.ts'), routeContent);
			
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			assert.match(generatedContent, /import \* as index from/);
			assert.match(generatedContent, /app\.get\('\/'/);
			assert.match(generatedContent, /index\.onRequestGet/);
		});
		
		it('should handle multiple HTTP methods', async () => {
			const routeContent = `
export const onRequestGet = (c) => c.json({ method: 'GET' });
export const onRequestPost = (c) => c.json({ method: 'POST' });
export const onRequestPut = (c) => c.json({ method: 'PUT' });
export const onRequestDelete = (c) => c.json({ method: 'DELETE' });
export const onRequestPatch = (c) => c.json({ method: 'PATCH' });`;
			fs.writeFileSync(path.join(routesDir, 'api.ts'), routeContent);
			
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			assert.match(generatedContent, /app\.get\('\/api', api\.onRequestGet\)/);
			assert.match(generatedContent, /app\.post\('\/api', api\.onRequestPost\)/);
			assert.match(generatedContent, /app\.put\('\/api', api\.onRequestPut\)/);
			assert.match(generatedContent, /app\.delete\('\/api', api\.onRequestDelete\)/);
			assert.match(generatedContent, /app\.patch\('\/api', api\.onRequestPatch\)/);
		});
		
		it('should handle dynamic routes', async () => {
			const usersDir = path.join(routesDir, 'users');
			fs.mkdirSync(usersDir);
			
			const dynamicRoute = `
export const onRequestGet = (c) => {
	const id = c.req.param('id');
	return c.json({ userId: id });
};`;
			fs.writeFileSync(path.join(usersDir, '[id].ts'), dynamicRoute);
			
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			assert.match(generatedContent, /app\.get\('\/users\/:id'/);
		});
		
		it('should ignore capitalized files (components)', async () => {
			const componentContent = `export const Component = () => <div>Test</div>;`;
			fs.writeFileSync(path.join(routesDir, 'UserComponent.tsx'), componentContent);
			
			const routeContent = `export const onRequestGet = (c) => c.json({ ok: true });`;
			fs.writeFileSync(path.join(routesDir, 'index.ts'), routeContent);
			
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			assert.doesNotMatch(generatedContent, /UserComponent/);
			assert.match(generatedContent, /index\.onRequestGet/);
		});
		
		it('should handle nested directories', async () => {
			const apiDir = path.join(routesDir, 'api');
			const v1Dir = path.join(apiDir, 'v1');
			fs.mkdirSync(v1Dir, { recursive: true });
			
			const routeContent = `export const onRequestGet = (c) => c.json({ version: 'v1' });`;
			fs.writeFileSync(path.join(v1Dir, 'users.ts'), routeContent);
			
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			assert.match(generatedContent, /app\.get\('\/api\/v1\/users'/);
		});
		
		it('should sort routes with static paths before dynamic paths', async () => {
			const usersDir = path.join(routesDir, 'users');
			fs.mkdirSync(usersDir);
			
			// Create both static and dynamic routes
			fs.writeFileSync(path.join(usersDir, '[id].ts'), 
				`export const onRequestGet = (c) => c.json({ dynamic: true });`);
			fs.writeFileSync(path.join(usersDir, 'profile.ts'), 
				`export const onRequestGet = (c) => c.json({ static: true });`);
			
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			const profileIndex = generatedContent.indexOf('/users/profile');
			const dynamicIndex = generatedContent.indexOf('/users/:id');
			
			assert(profileIndex < dynamicIndex, 'Static route should come before dynamic route');
		});
		
		it('should handle factory methods with spread operator', async () => {
			const routeContent = `
const createHandlers = () => [(c) => c.json({ ok: true })];
export const onRequestGet = createHandlers();`;
			fs.writeFileSync(path.join(routesDir, 'factory.ts'), routeContent);
			
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			assert.match(generatedContent, /app\.get\('\/factory', \.\.\.factory\.onRequestGet\)/);
		});
		
		it('should sanitize special characters in import names', async () => {
			const specialDir = path.join(routesDir, '@special');
			fs.mkdirSync(specialDir);
			
			fs.writeFileSync(path.join(specialDir, '-dash-file.ts'), 
				`export const onRequestGet = (c) => c.json({ ok: true });`);
			
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			// Should sanitize @special/-dash-file to special__dash_file
			assert.match(generatedContent, /import \* as special__dash_file/);
		});
	});
	
	describe('CLI flags', () => {
		it('should run in single-shot mode by default', async () => {
			fs.writeFileSync(path.join(routesDir, 'test.ts'), 
				`export const onRequestGet = (c) => c.json({ ok: true });`);
			
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			assert.doesNotMatch(result.stdout, /Watching for changes/);
		});
		
		it('should enter watch mode with --watch flag', async () => {
			fs.writeFileSync(path.join(routesDir, 'test.ts'), 
				`export const onRequestGet = (c) => c.json({ ok: true });`);
			
			const result = await runCLI([routesDir, outputFile, '--watch']);
			assert.match(result.stdout, /Watching for changes/);
		});
		
		it('should enter watch mode with -w flag', async () => {
			fs.writeFileSync(path.join(routesDir, 'test.ts'), 
				`export const onRequestGet = (c) => c.json({ ok: true });`);
			
			const result = await runCLI([routesDir, outputFile, '-w']);
			assert.match(result.stdout, /Watching for changes/);
		});
		
		it('should handle --deno flag for Deno compatibility', async () => {
			fs.writeFileSync(path.join(routesDir, 'index.ts'), 
				`export const onRequestGet = (c) => c.json({ ok: true });`);
			
			const result = await runCLI([routesDir, outputFile, '--deno']);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			// With --deno flag, should include file extension in import path
			assert.match(generatedContent, /from '\.\/routes\/index\.ts'/);
		});
		
		it('should show usage when arguments are missing', async () => {
			const result = await runCLI([]);
			assert.notStrictEqual(result.code, 0);
			assert.match(result.stderr, /Usage: npx hono-router/);
		});
	});
	
	describe('Edge cases', () => {
		it('should handle empty routes directory', async () => {
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			assert.match(generatedContent, /export const loadRoutes/);
			// Should have empty route definitions
			assert.match(generatedContent, /=> \{\s*\};/);
		});
		
		it('should handle index.ts files correctly', async () => {
			const apiDir = path.join(routesDir, 'api');
			fs.mkdirSync(apiDir);
			
			fs.writeFileSync(path.join(apiDir, 'index.ts'), 
				`export const onRequestGet = (c) => c.json({ index: true });`);
			
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			// index.ts should map to /api not /api/index
			assert.match(generatedContent, /app\.get\('\/api'/);
			assert.doesNotMatch(generatedContent, /\/api\/index/);
		});
		
		it('should handle files with no exports', async () => {
			fs.writeFileSync(path.join(routesDir, 'utils.ts'), 
				`const helper = () => console.log('helper');`);
			fs.writeFileSync(path.join(routesDir, 'api.ts'), 
				`export const onRequestGet = (c) => c.json({ ok: true });`);
			
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			assert.doesNotMatch(generatedContent, /utils/);
			assert.match(generatedContent, /api\.onRequestGet/);
		});
		
		it('should handle deeply nested dynamic routes', async () => {
			const deepPath = path.join(routesDir, 'api', 'v1', 'users', '[userId]', 'posts');
			fs.mkdirSync(deepPath, { recursive: true });
			
			fs.writeFileSync(path.join(deepPath, '[postId].ts'), 
				`export const onRequestGet = (c) => c.json({ nested: true });`);
			
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			assert.match(generatedContent, /app\.get\('\/api\/v1\/users\/:userId\/posts\/:postId'/);
		});
	});
	
	describe('Greedy matching', () => {
		it('should handle double-bracket greedy matching', async () => {
			const apiDir = path.join(routesDir, 'api');
			fs.mkdirSync(apiDir);
			
			fs.writeFileSync(path.join(apiDir, '[[path]].ts'), 
				`export const onRequestGet = (c) => c.json({ greedy: true });`);
			
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			assert.match(generatedContent, /app\.get\('\/api\/:path\{\.\+\}'/);
		});
		
		it('should handle spread syntax for catch-all routes', async () => {
			const docsDir = path.join(routesDir, 'docs');
			fs.mkdirSync(docsDir);
			
			fs.writeFileSync(path.join(docsDir, '[...slug].ts'), 
				`export const onRequestGet = (c) => c.json({ catchAll: true });`);
			
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			assert.match(generatedContent, /app\.get\('\/docs\/:slug\{\.\*\}'/);
		});
		
		it('should sort greedy routes after static and dynamic routes', async () => {
			const apiDir = path.join(routesDir, 'api');
			fs.mkdirSync(apiDir);
			
			// Create routes in reverse priority order
			fs.writeFileSync(path.join(apiDir, '[[blob]].ts'), 
				`export const onRequestGet = (c) => c.json({ type: 'greedy' });`);
			fs.writeFileSync(path.join(apiDir, '[id].ts'), 
				`export const onRequestGet = (c) => c.json({ type: 'dynamic' });`);
			fs.writeFileSync(path.join(apiDir, 'users.ts'), 
				`export const onRequestGet = (c) => c.json({ type: 'static' });`);
			
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			const usersIndex = generatedContent.indexOf('/api/users');
			const dynamicIndex = generatedContent.indexOf('/api/:id');
			const greedyIndex = generatedContent.indexOf('/api/:blob{.+}');
			
			assert(usersIndex < dynamicIndex, 'Static route should come before dynamic route');
			assert(dynamicIndex < greedyIndex, 'Dynamic route should come before greedy route');
		});
		
		it('should handle nested greedy routes', async () => {
			const v1Dir = path.join(routesDir, 'api', 'v1');
			fs.mkdirSync(v1Dir, { recursive: true });
			
			fs.writeFileSync(path.join(v1Dir, '[[...rest]].ts'), 
				`export const onRequestGet = (c) => c.json({ rest: true });`);
			
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			assert.match(generatedContent, /app\.get\('\/api\/v1\/:rest\{\.\*\}'/);
		});
		
		it('should handle multiple greedy parameters in path', async () => {
			const proxyDir = path.join(routesDir, 'proxy', '[[host]]');
			fs.mkdirSync(proxyDir, { recursive: true });
			
			fs.writeFileSync(path.join(proxyDir, '[[...path]].ts'), 
				`export const onRequestGet = (c) => c.json({ proxy: true });`);
			
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			assert.match(generatedContent, /app\.get\('\/proxy\/:host\{\.\+\}\/:path\{\.\*\}'/);
		});
		
		it('should handle greedy routes with multiple HTTP methods', async () => {
			const restDir = path.join(routesDir, 'rest');
			fs.mkdirSync(restDir);
			
			const routeContent = `
export const onRequestGet = (c) => c.json({ method: 'GET' });
export const onRequestPost = (c) => c.json({ method: 'POST' });
export const onRequestPut = (c) => c.json({ method: 'PUT' });
export const onRequestDelete = (c) => c.json({ method: 'DELETE' });`;
			fs.writeFileSync(path.join(restDir, '[[...path]].ts'), routeContent);
			
			const result = await runCLI([routesDir, outputFile]);
			assert.strictEqual(result.code, 0);
			
			const generatedContent = fs.readFileSync(outputFile, 'utf-8');
			assert.match(generatedContent, /app\.get\('\/rest\/:path\{\.\*\}', rest_path\.onRequestGet\)/);
			assert.match(generatedContent, /app\.post\('\/rest\/:path\{\.\*\}', rest_path\.onRequestPost\)/);
			assert.match(generatedContent, /app\.put\('\/rest\/:path\{\.\*\}', rest_path\.onRequestPut\)/);
			assert.match(generatedContent, /app\.delete\('\/rest\/:path\{\.\*\}', rest_path\.onRequestDelete\)/);
		});
	});
});