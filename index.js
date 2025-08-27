#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const colors = {
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	white: '\x1b[37m',
	reset: '\x1b[0m',
};

/**
 * @typedef {Object} Route
 * @property {string} method
 * @property {string} path
 * @property {string} handler
 * @property {boolean} isFactory
 */

/**
 * Get exported methods from file content
 * @param {string} fileContent
 * @returns {Array<{method: string, isFactory: boolean}>}
 */
const getExportedMethods = (fileContent) => {
	const methods = [
		'onRequestGet',
		'onRequestPut',
		'onRequestPost',
		'onRequestDelete',
		'onRequestPatch',
	];
	
	return methods.flatMap(method => {
		// Check for factory method export (array return)
		const factoryRegex = new RegExp(`export const ${method} = .*createHandlers`);
		if (factoryRegex.test(fileContent)) {
			return [{ method, isFactory: true }];
		}

		// Check for standard export
		if (fileContent.includes(`export const ${method}`)) {
			return [{ method, isFactory: false }];
		}
		return [];
	});
};

/**
 * Check if string is capitalized
 * @param {string} str
 * @returns {boolean}
 */
const isCapitalized = (str) => {
	const letter = str[0];
	return letter === letter.toUpperCase() && letter !== letter.toLowerCase();
};

/**
 * Generate routes
 * @param {string} dir
 * @param {string} out
 */
const generateRoutes = (dir, out, isDeno) => {
	/** @type {string[]} */
	const imports = [];
	/** @type {Route[]} */
	const routes = [];

	/**
	 * Traverse directories
	 * @param {string} currentPath
	 * @param {string} [basePath='']
	 */
	const traverseDirectories = (currentPath, basePath = '') => {
		const entries = fs.readdirSync(currentPath, { withFileTypes: true });

		for (const entry of entries) {
			const entryPath = path.join(currentPath, entry.name);
			const importPath = path.posix
				.join(basePath, entry.name)
				.replace(/\.(ts|tsx)$/, '');
			if (entry.isDirectory()) {
				traverseDirectories(entryPath, importPath);
			} else if (
				entry.isFile() &&
				!isCapitalized(entry.name) &&
				(entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
			) {
				const fileContent = fs.readFileSync(entryPath, 'utf-8');
				const exportedMethods = getExportedMethods(fileContent);
				if (exportedMethods.length > 0) {
					const safeName = importPath
						.replace(/[@/\\]/g, '_')
						.replace(/^_+/, '')
						.replace(/-/g, '_')
						.replace(/\[\[\.\.\.(.+?)\]\]/g, '$1')  // Remove [[...param]]
						.replace(/\[\.\.\.(.+?)\]/g, '$1')      // Remove [...param]
						.replace(/\[\[(.+?)\]\]/g, '$1')        // Remove [[param]]
						.replace(/\[(.+?)\]/g, '$1');
					const importPathString = isDeno ? path.posix.join(basePath, entry.name) : importPath.replace(/index$/, '');
					const relativePath = path.posix
						.relative(path.dirname(out), path.join(dir, importPathString))
						.replace(/\\/g, '/');
					imports.push(`import * as ${safeName} from './${relativePath}';`);
					exportedMethods.forEach(({ method, isFactory }) => {
						const routePath = importPath
							.replace(/index$/, '')
							.replace(/\[\[\.\.\.(.+?)\]\]/g, ':$1{.*}') // [[...param]] -> :param{.*} (alternate spread syntax)
							.replace(/\[\.\.\.(.+?)\]/g, ':$1{.*}')     // [...param] -> :param{.*} (zero or more segments)
							.replace(/\[\[(.+?)\]\]/g, ':$1{.+}')       // [[param]] -> :param{.+} (one or more segments)
							.replace(/\[(.+?)\]/g, ':$1')               // [param] -> :param (single segment)
							.replace(/\/$/, '');
						const methodName = method.replace('onRequest', '').toLowerCase();
						console.log(
							colors.blue,
							`${methodName.toUpperCase()} /${routePath}${isFactory ? ' (factory)' : ''}`,
							colors.reset
						);
						routes.push({
							method: methodName,
							path: `/${routePath}`,
							handler: `${safeName}.${method}`,
							isFactory
						});
					});
				}
			}
		}
	};

	traverseDirectories(dir);

	/**
	 * Custom sort function to prioritize static paths over dynamic paths over greedy paths
	 * @param {Route} a
	 * @param {Route} b
	 * @returns {number}
	 */
	const sortPaths = (a, b) => {
		const aParts = a.split('/');
		const bParts = b.split('/');
		for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
			const aPart = aParts[i] || '';
			const bPart = bParts[i] || '';
			if (aPart === bPart) continue;
			
			// Check if parts are parameters
			const aIsParam = aPart.startsWith(':');
			const bIsParam = bPart.startsWith(':');
			
			// Check if parts are greedy parameters (contain {.+} or {.*})
			const aIsGreedy = aIsParam && (aPart.includes('{.+}') || aPart.includes('{.*}'));
			const bIsGreedy = bIsParam && (bPart.includes('{.+}') || bPart.includes('{.*}'));
			
			// Static routes come first
			if (!aIsParam && bIsParam) return -1;
			if (aIsParam && !bIsParam) return 1;
			
			// Among parameters, non-greedy come before greedy
			if (aIsParam && bIsParam) {
				if (!aIsGreedy && bIsGreedy) return -1;
				if (aIsGreedy && !bIsGreedy) return 1;
			}
			
			// Alphabetical comparison for same type
			if (aPart > bPart) return 1;
			if (aPart < bPart) return -1;
		}
		return 0;
	};

	// sort imports by path
	imports.sort((a, b) => sortPaths(a.match(/'(.*)'/)[1], b.match(/'(.*)'/)[1]));
	// sort routes by path
	routes.sort((a, b) => sortPaths(a.path, b.path));

	const routesOutput = routes.map(route => 
		route.isFactory 
			? `app.${route.method}('${route.path}', ...${route.handler});`
			: `app.${route.method}('${route.path}', ${route.handler});`
	);

	const outputContent = `
import { Hono, Env } from 'hono';

${imports.join('\n')}

export const loadRoutes = <T extends Env>(app: Hono<T>) => {
\t${routesOutput.join('\n\t')}
};`;

	fs.writeFileSync(out, outputContent);
	console.log(colors.magenta, `Routes generated in ${out}`, colors.reset);
};

const args = process.argv.slice(2);

// Check for watch flag
const watchFlagIndex = args.findIndex(arg => arg === '--watch' || arg === '-w');
const isWatchMode = watchFlagIndex !== -1;
if (isWatchMode) {
	args.splice(watchFlagIndex, 1); // Remove the watch flag from the arguments
}

// Check for deno flag
const denoFlagIndex = args.indexOf('--deno');
const isDeno = denoFlagIndex !== -1;
if (isDeno) {
	args.splice(denoFlagIndex, 1); // Remove the --deno flag from the arguments
}

const [routesDir, outputFile] = args;
if (!routesDir || !outputFile) {
	console.error(
		colors.red,
		'Usage: npx hono-router <routesDir> <outputFile> [--watch | -w] [--deno]',
		colors.reset
	);
	process.exit(1);
}

// Initial generation
generateRoutes(routesDir, outputFile, isDeno);

// Watch mode only if flag is provided
if (isWatchMode) {
	console.log(colors.cyan, 'Watching for changes...', colors.reset);
	fs.watch(routesDir, { recursive: true }, (eventType, filename) => {
		console.log(
			colors.green,
			`Detected ${eventType} in ${filename}, regenerating router.ts...`,
			colors.reset
		);
		generateRoutes(routesDir, outputFile, isDeno);
	});
}
