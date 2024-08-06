import { Context } from 'hono';

export const onRequestPost = async (c: Context) => {
	c.render(<div>About Post</div>);
};

export const onRequestGet = async (c: Context) => {
	const user_id = c.req.param('user_id');
	c.render(<div>User {user_id}</div>);
};
