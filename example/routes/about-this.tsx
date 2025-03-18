import { createFactory } from 'hono/factory'

export const factory = createFactory();

export const onRequestGet = factory.createHandlers(
	async (c) => {
		return c.render(<div>About</div>);
	}
);