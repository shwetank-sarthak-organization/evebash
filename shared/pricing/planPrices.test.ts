import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatRupees, readPricingPlans, serverPlanPrice } from './planPrices';

test('rupees use Indian digit grouping', () => {
  assert.equal(formatRupees(0), '₹0');
  assert.equal(formatRupees(399), '₹399');
  assert.equal(formatRupees(1249), '₹1,249');
  assert.equal(formatRupees(31499), '₹31,499');
  assert.equal(formatRupees(125000), '₹1,25,000');
  assert.equal(formatRupees(12345678), '₹1,23,45,678');
});

const plans = readPricingPlans({
  plans: [
    { id: 'starter', active: true, monthlyPrice: 150, threeMonthPrice: 399, sixMonthPrice: 749, discountedYearlyPrice: 1249 },
    { id: 'basic', active: false, monthlyPrice: 300 },
    { id: 'pro', monthlyPrice: null },
    null,
  ],
});

test('each cycle reads its own field', () => {
  assert.equal(serverPlanPrice(plans, 'starter', 'monthly'), '₹150');
  assert.equal(serverPlanPrice(plans, 'starter', 'quarterly'), '₹399');
  assert.equal(serverPlanPrice(plans, 'starter', 'semiannual'), '₹749');
  assert.equal(serverPlanPrice(plans, 'starter', 'yearly'), '₹1,249');
});

test('missing, inactive or empty prices give null so the app keeps its own', () => {
  assert.equal(serverPlanPrice(plans, 'basic', 'monthly'), null);
  assert.equal(serverPlanPrice(plans, 'pro', 'monthly'), null);
  assert.equal(serverPlanPrice(plans, 'nope', 'monthly'), null);
  assert.equal(serverPlanPrice(null, 'starter', 'monthly'), null);
  assert.equal(readPricingPlans({ error: 'x' }), null);
});
