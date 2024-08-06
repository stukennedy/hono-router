import { Context } from 'hono';

export const onRequestPost = async (c: Context) => {
	c.render(<div>About Post</div>);
};
