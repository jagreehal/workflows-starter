import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { logger, Logger } from '@/logger';
import { Env, Payment } from '@/types';
import { PAYMENTS } from '@/data';

type WithRetryWorkflowParams = {
	payments?: Payment[];
};

export class WithRetryWorkflow extends WorkflowEntrypoint<Env, WithRetryWorkflowParams> {
	async run(event: WorkflowEvent<WithRetryWorkflowParams>, step: WorkflowStep) {
		const paymentsToProcess = await step.do('get payments to process', async () => {
			return [...(event.payload.payments || PAYMENTS)];
		});

		while (paymentsToProcess.length > 0) {
			const payment = paymentsToProcess.pop();
			if (!payment) break;

			await step.do(
				'process payment',
				{
					retries: {
						limit: 5,
						delay: '5 seconds',
						backoff: 'exponential',
					},
					timeout: 15 * 60 * 1000,
				},
				async () => {
					if (Math.random() < 0.5) {
						logger.error(`Failed to process payment with id: ${payment.id}`);
						throw new Error('Failed to process payment');
					}
					this.env.KV.WORKFLOW_EXAMPLES.put('payment', `${payment.id} processed`);
					await new Promise((resolve) => setTimeout(resolve, 1000));
					return paymentsToProcess;
				}
			);
		}

		logger.info('No more items left to process.');
	}
}
