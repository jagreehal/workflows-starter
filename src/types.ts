export type Env = {
	WORKFLOWS: {
		WITH_RETRY_WORKFLOW: Workflow;
		PAYMENT_PROVIDER_A: Workflow;
		PAYMENT_PROVIDER_B: Workflow;
		PAYMENT_BATCH_WORKFLOW: Workflow;
	};
	KV: {
		WORKFLOW_EXAMPLES: KVNamespace;
	};
};

export type WORKFLOWS = keyof Env['WORKFLOWS'];
export type KV = keyof Env['KV'];

export type PaymentProviderType = 'PAYMENT_PROVIDER_A' | 'PAYMENT_PROVIDER_B';

export type Payment = {
	id: string;
	amount: string;
	currency: string;
	paymentProvider: PaymentProviderType;
};

export type BALANCES = Record<string, string>;
