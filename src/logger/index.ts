interface LoggerOptions {
	level?: LogLevel;
	base?: Record<string, unknown>;
}

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export class Logger {
	private options: LoggerOptions;
	private levels: { [key in LogLevel]: number };

	constructor(options: LoggerOptions = {}) {
		this.options = {
			level: 'info',
			base: {},
			...options,
		};
		this.levels = {
			trace: 10,
			debug: 20,
			info: 30,
			warn: 40,
			error: 50,
			fatal: 60,
		};
	}

	private output(logObject: object) {
		console.log(JSON.stringify(logObject));
	}

	private log(level: LogLevel, objOrMsg: object | string = {}, msg: string = '') {
		const isObj = typeof objOrMsg === 'object';
		const obj = isObj ? (objOrMsg as object) : {};
		const message = isObj ? msg : (objOrMsg as string);

		if (this.levels[level] >= this.levels[this.options.level || 'info']) {
			const logObject = {
				level,
				time: new Date().toISOString(),
				...this.options.base,
				...obj,
				msg: message,
			};
			this.output(logObject);
		}
	}

	trace(objOrMsg: object | string, msg?: string) {
		this.log('trace', objOrMsg, msg || '');
	}
	debug(objOrMsg: object | string, msg?: string) {
		this.log('debug', objOrMsg, msg || '');
	}
	info(objOrMsg: object | string, msg?: string) {
		this.log('info', objOrMsg, msg || '');
	}
	warn(objOrMsg: object | string, msg?: string) {
		this.log('warn', objOrMsg, msg || '');
	}
	error(objOrMsg: object | string, msg?: string) {
		this.log('error', objOrMsg, msg || '');
	}
	fatal(objOrMsg: object | string, msg?: string) {
		this.log('fatal', objOrMsg, msg || '');
	}

	child(context: Record<string, unknown>) {
		return new Logger({
			...this.options,
			base: { ...this.options.base, ...context },
		});
	}
}

export const logger = new Logger();
