import { logger, LogLevel } from './logger';

/**
 * Configure the application's logging level
 * 
 * @param level The log level to set
 * - LogLevel.NONE: No logging
 * - LogLevel.ERROR: Only errors
 * - LogLevel.WARN: Errors and warnings
 * - LogLevel.INFO: Errors, warnings, and info messages (default in development)
 * - LogLevel.DEBUG: All messages including debug (verbose)
 * 
 * @example
 * // To enable debug logging
 * configureLogging(LogLevel.DEBUG);
 * 
 * // To disable all logging
 * configureLogging(LogLevel.NONE);
 */
export function configureLogging(level: LogLevel): void {
  logger.setLogLevel(level);
  logger.info('Logger', `Log level set to: ${LogLevel[level]}`);
}

/**
 * Get the current logging level
 * 
 * @returns The current log level
 */
export function getLoggingLevel(): LogLevel {
  return logger.getLogLevel();
} 