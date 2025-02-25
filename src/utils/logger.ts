export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4
}

// Default to INFO in development, ERROR in production
const DEFAULT_LOG_LEVEL = process.env.NODE_ENV === 'production' 
  ? LogLevel.ERROR 
  : LogLevel.INFO;

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = DEFAULT_LOG_LEVEL;
  
  private constructor() {}
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
  
  getLogLevel(): LogLevel {
    return this.logLevel;
  }
  
  private formatMessage(level: string, source: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${source}]: ${message}`;
  }
  
  debug(source: string, message: string, ...args: any[]): void {
    if (this.logLevel >= LogLevel.DEBUG) {
      console.debug(this.formatMessage('DEBUG', source, message), ...args);
    }
  }
  
  info(source: string, message: string, ...args: any[]): void {
    if (this.logLevel >= LogLevel.INFO) {
      console.info(this.formatMessage('INFO', source, message), ...args);
    }
  }
  
  warn(source: string, message: string, ...args: any[]): void {
    if (this.logLevel >= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', source, message), ...args);
    }
  }
  
  error(source: string, message: string, ...args: any[]): void {
    if (this.logLevel >= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', source, message), ...args);
    }
  }
}

export const logger = Logger.getInstance(); 