import { PAYMENTS } from '@/data';
import { logger } from '@/logger';
import { BALANCES, Payment, PaymentProviderType } from '@/types';
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

type PaymentBatchWorkflowParams = {
	payments: Payment[];
};

type WorkflowInfo = {
	readonly id: string;
	readonly provider: PaymentProviderType;
};

async function randomDelay() {
	await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000));
}

export class PaymentBatchWorkflow extends WorkflowEntrypoint<Env, PaymentBatchWorkflowParams> {
	async run(event: WorkflowEvent<PaymentBatchWorkflowParams>, step: WorkflowStep) {
		const payments = await step.do('get payments to process', async () => {
			return [...(event.payload.payments || PAYMENTS)];
		});

		// Later invoke using events
		const PAYMENT_PROVIDERS = {
			PAYMENT_PROVIDER_A: this.env.PAYMENT_PROVIDER_A_WORKFLOW,
			PAYMENT_PROVIDER_B: this.env.PAYMENT_PROVIDER_B_WORKFLOW,
		} as const;

		const paymentProviderWorkflows = await step.do('create provider workflows', async () => {
			return await Promise.all(
				(Object.entries(PAYMENT_PROVIDERS) as [PaymentProviderType, (typeof PAYMENT_PROVIDERS)[PaymentProviderType]][]).map(
					async ([provider, workflow]) => {
						const workflowInstance = await workflow.create({
							id: crypto.randomUUID(),
							params: { payments },
						});
						return {
							id: workflowInstance.id,
							provider,
						} as const;
					}
				)
			);
		});

		// Poll until workflows complete
		let incompleteWorkflows: readonly WorkflowInfo[] = paymentProviderWorkflows;
		while (incompleteWorkflows.length > 0) {
			incompleteWorkflows = await step.do(
				'poll workflows',
				{
					retries: {
						limit: 5,
						delay: '5 seconds',
						backoff: 'exponential',
					},
					timeout: 15 * 60 * 1000,
				},
				async () => {
					const updatedWorkflows = await Promise.all(
						incompleteWorkflows.map(async ({ id, provider }) => {
							const workflow = await PAYMENT_PROVIDERS[provider].get(id);
							const { status } = await workflow.status();

							logger.info({ workflowId: id, provider, status }, 'Workflow status update');

							if (status === 'complete') {
								return null;
							}
							if (status === 'errored') {
								throw new Error(`Workflow for provider ${provider} failed`);
							}

							await new Promise((resolve) => setTimeout(resolve, 1000));
							return { id, provider } as const;
						})
					);

					return updatedWorkflows.filter((workflow): workflow is WorkflowInfo => workflow !== null);
				}
			);
		}

		logger.info('All payment provider workflows completed successfully.');
	}
}

type PaymentProviderWorkflowParams = {
	payments: Payment[];
};

export class PaymentProviderAWorkflow extends WorkflowEntrypoint<Env, PaymentProviderWorkflowParams> {
	async run(event: WorkflowEvent<PaymentProviderWorkflowParams>, step: WorkflowStep) {
		const payments = await step.do('filter payments', async () => {
			const filteredPayments = event.payload.payments.filter((payment) => payment.paymentProvider === 'PAYMENT_PROVIDER_B');
			logger.info({ numberOfPayments: filteredPayments.length }, 'Filtered payments');
			return filteredPayments;
		});

		for (let i = 0; i < payments.length; i++) {
			await step.do(
				`process payment ${i}`,
				{
					retries: {
						limit: 5,
						delay: '5 seconds',
						backoff: 'exponential',
					},
					timeout: 15 * 60 * 1000,
				},
				async () => {
					const payment = payments[i];
					await randomDelay();
					if (Math.random() < 0.5) {
						logger.error({ payment }, `Failed to process payment`);
						throw new Error('Failed to process payment');
					}
					logger.info({ payment }, 'Processed payment');

					return payment;
				}
			);
		}

		logger.info(`${payments.length} payments processed successfully.`);
	}
}

export class PaymentProviderBWorkflow extends WorkflowEntrypoint<Env, PaymentProviderWorkflowParams> {
	async run(event: WorkflowEvent<PaymentProviderWorkflowParams>, step: WorkflowStep) {
		const payments = await step.do('filter payments', async () => {
			const filteredPayments = event.payload.payments.filter((payment) => payment.paymentProvider === 'PAYMENT_PROVIDER_B');
			logger.info({ numberOfPayments: filteredPayments.length }, 'Filtered payments');
			return filteredPayments;
		});

		const balances: BALANCES = await step.do(
			'get balances',
			{
				retries: {
					limit: 5,
					delay: '5 seconds',
					backoff: 'exponential',
				},
				timeout: 15 * 60 * 1000,
			},
			async () => {
				try {
					await randomDelay();
					logger.info({ payments }, 'Getting balances');

					return { GBP: '1000', USD: '2000' };
				} catch (error) {
					logger.error({ error }, 'Error getting balances');
					throw error;
				}
			}
		);

		for (let i = 0; i < payments.length; i++) {
			await step.do(
				`process payment ${i}`,
				{
					retries: {
						limit: 5,
						delay: '5 seconds',
						backoff: 'exponential',
					},
					timeout: 15 * 60 * 1000,
				},
				async () => {
					try {
						const payment = payments[i];
						if (!payment) throw new Error('No payment to process');
						logger.info({ payment }, 'Processing payment');
						await randomDelay();
						const paymentBalance = balances[payment.currency];
						if (!paymentBalance) {
							logger.warn(`No balance found for currency: ${payment.currency}. Skipping payment.`);
							return null;
						}
						if (Number(paymentBalance) < Number(payment.amount)) {
							logger.warn(`Insufficient funds for payment id: ${payment.id}. Skipping payment.`);
							return null;
						}
						balances[payment.currency] = (Number(paymentBalance) - Number(payment.amount)).toString();
						return payment;
					} catch (error) {
						logger.error({ error }, 'Error processing payment');
						throw error;
					}
				}
			);
		}

		logger.info(`${payments.length} payments processed successfully.`);
	}
}
