import { Context } from 'hono';

export const onRequestGet = async (c: Context) => {
	c.render(<h1>Hello, World!</h1>);
};
