import { config } from "../config/config.js";

import type {
  AlertMetric,
  AlertState,
  SystemMetrics,
} from "../types/metrics.js";

const states = new Map<AlertMetric, AlertState>();

function getState(metric: AlertMetric): AlertState {
  const existing = states.get(metric);

  if (existing) {
    return existing;
  }

  const state: AlertState = {
    active: false,

    consecutiveFailures: 0,

    lastAlertAt: 0,

    lastValue: null,
  };

  states.set(metric, state);

  return state;
}

export interface ThresholdViolation {
  metric: AlertMetric;

  value: number;

  threshold: number;

  message: string;
}

export function evaluateThresholds(
  metrics: SystemMetrics,
): ThresholdViolation[] {
  const violations: ThresholdViolation[] = [];

  // CPU
  if (metrics.cpu.usagePercent > config.thresholds.cpu) {
    violations.push({
      metric: "cpu",

      value: metrics.cpu.usagePercent,

      threshold: config.thresholds.cpu,

      message: `CPU usage is above ${config.thresholds.cpu}%`,
    });
  }

  // RAM
  if (metrics.memory.usagePercent > config.thresholds.ram) {
    violations.push({
      metric: "ram",

      value: metrics.memory.usagePercent,

      threshold: config.thresholds.ram,

      message: `RAM usage is above ${config.thresholds.ram}%`,
    });
  }

  // Swap
  if (
    metrics.memory.swapTotalBytes > 0 &&
    metrics.memory.swapUsagePercent > config.thresholds.swap
  ) {
    violations.push({
      metric: "swap",

      value: metrics.memory.swapUsagePercent,

      threshold: config.thresholds.swap,

      message: `Swap usage is above ${config.thresholds.swap}%`,
    });
  }

  // Load Average
  const loadThreshold = metrics.cpu.cores * config.thresholds.loadMultiplier;

  if (metrics.cpu.load[0] > loadThreshold) {
    violations.push({
      metric: "load",

      value: metrics.cpu.load[0],

      threshold: loadThreshold,

      message: `1-minute load is above ${loadThreshold.toFixed(1)}`,
    });
  }

  // CPU Temperature
  if (
    metrics.cpu.temperatureC !== null &&
    metrics.cpu.temperatureC > config.thresholds.temperature
  ) {
    violations.push({
      metric: "temperature",

      value: metrics.cpu.temperatureC,

      threshold: config.thresholds.temperature,

      message: `CPU temperature is above ${config.thresholds.temperature}°C`,
    });
  }

  // Disk
  for (const disk of metrics.disks) {
    if (disk.usagePercent > config.thresholds.disk) {
      violations.push({
        metric: "disk",

        value: disk.usagePercent,

        threshold: config.thresholds.disk,

        message: `${disk.mount} usage is above ${config.thresholds.disk}%`,
      });
    }
  }

  return violations;
}

export interface AlertDecision {
  alert: boolean;
  recover: boolean;
}

export function updateAlertState(violation: ThresholdViolation): AlertDecision {
  const state = getState(violation.metric);

  state.lastValue = violation.value;

  state.consecutiveFailures++;

  const now = Date.now();

  if (
    !state.active &&
    state.consecutiveFailures >= config.alerts.consecutiveFailures &&
    now - state.lastAlertAt >= config.alerts.cooldownMs
  ) {
    state.active = true;

    state.lastAlertAt = now;

    return {
      alert: true,
      recover: false,
    };
  }

  return {
    alert: false,
    recover: false,
  };
}

export function processRecoveries(
  metrics: SystemMetrics,
  currentViolations: ThresholdViolation[],
): AlertMetric[] {
  const current = new Set(
    currentViolations.map((violation) => violation.metric),
  );

  const recovered: AlertMetric[] = [];

  for (const [metric, state] of states) {
    if (!state.active || current.has(metric)) {
      continue;
    }

    let value: number | null = null;

    switch (metric) {
      case "cpu":
        value = metrics.cpu.usagePercent;
        break;

      case "ram":
        value = metrics.memory.usagePercent;
        break;

      case "swap":
        value = metrics.memory.swapUsagePercent;
        break;

      case "load":
        value = metrics.cpu.load[0];
        break;

      case "temperature":
        value = metrics.cpu.temperatureC;
        break;

      case "disk":
        value = Math.max(...metrics.disks.map((disk) => disk.usagePercent), 0);
        break;
    }

    if (value !== null && value <= config.alerts.recoveryThreshold) {
      state.active = false;

      state.consecutiveFailures = 0;

      state.lastValue = value;

      recovered.push(metric);
    }
  }

  return recovered;
}

export function resetFailureCounter(metric: AlertMetric): void {
  const state = getState(metric);

  if (!state.active) {
    state.consecutiveFailures = 0;
  }
}
