
import { Hono, Env } from 'hono';

import * as index from './routes';
import * as about_this from './routes/about-this';
import * as users_user_id from './routes/users/[user_id]';

export const loadRoutes = <T extends Env>(app: Hono<T>) => {
	app.get('/', index.onRequestGet);
	app.get('/about-this', ...about_this.onRequestGet);
	app.get('/users/:user_id', users_user_id.onRequestGet);
	app.post('/users/:user_id', users_user_id.onRequestPost);
};