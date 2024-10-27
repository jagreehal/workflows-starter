import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { PaymentProviderAWorkflow, PaymentProviderBWorkflow, PaymentBatchWorkflow } from '@/workflows/payment-batch-workflow';
import { WithRetryWorkflow } from '@/workflows/with-retry-workflow';
import { Logger } from '@/logger';

// required by Cloudflare
export { WithRetryWorkflow, PaymentBatchWorkflow, PaymentProviderAWorkflow, PaymentProviderBWorkflow };
const logger = new Logger();

const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', cors());

app.get('/', (c) => {
	return c.json({ message: 'Hello, world!' });
});

app.get('api/workflow/:name/:id', async (c) => {
	const { name, id } = c.req.param();

	const workflow = c.env.WORKFLOWS[name as keyof Env['WORKFLOWS']];

	if (!workflow) {
		return c.json({ error: 'Workflow not found' }, { status: 404 });
	}

	let instance = await workflow.get(id);

	if (!instance) {
		return c.json({ error: 'Instance not found' }, { status: 404 });
	}
	return c.json({
		status: await instance.status(),
		id: instance.id,
	});
});

app.post('api/workflow/:name', async (c) => {
	const { name } = c.req.param();

	const workflow = c.env.WORKFLOWS[name as keyof Env['WORKFLOWS']];

	if (!workflow) {
		return c.json({ error: 'Workflow not found' }, { status: 404 });
	}

	let instance = await workflow.create();
	logger.info({ instance, id: instance.id }, 'Created new instance:');
	return Response.json({
		id: instance.id,
		details: await instance.status(),
	});
});

app.get('/api/hello', (c) => {
	return c.json({ message: 'Hello from the API!' });
});

export default app;
