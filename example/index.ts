import { Hono } from 'hono';
import { loadRoutes } from './router';

const app = new Hono();
loadRoutes(app);

export default app;
