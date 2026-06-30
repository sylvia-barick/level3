import { Horizon } from '@stellar/stellar-sdk';

export interface ReputationScore {
  score: number; // 0 to 100
  tier: 'Starter' | 'Trusted' | 'Elite';
  factors: {
    accountAge: number; // Points for age
    transactionCount: number; // Points for activity
    daysOld: number;
    totalTxs: number;
  };
}

export async function calculateReputation(
  createdAt: string | null,
  txCount: number,
  paymentCount: number
): Promise<ReputationScore> {
  // 1. Calculate Age Factor (Max 20 points)
  let ageFactor = 0;
  let daysOld = 0;
  if (createdAt) {
    const createdDate = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
    daysOld = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // 1 point per 10 days, cap at 20
    ageFactor = Math.min(daysOld / 10, 20);
  }

  // 2. Calculate Activity Score (Max 80 points)
  // 2 points per transaction/payment as per user requirement (txCount * 2)
  const totalActivity = txCount + paymentCount;
  const activityScore = Math.min(totalActivity * 2, 80);

  const totalScore = Math.round(ageFactor + activityScore);
  
  let tier: ReputationScore['tier'] = 'Starter';
  if (totalScore > 75) tier = 'Elite';
  else if (totalScore >= 40) tier = 'Trusted';

  return {
    score: totalScore,
    tier,
    factors: {
      accountAge: Math.round(ageFactor),
      transactionCount: Math.round(activityScore),
      daysOld,
      totalTxs: totalActivity
    }
  };
}

export function calculateInterestRate(score: number): number {
  const baseRate = 15;
  const minRate = 5;
  // Formula: Interest Rate = Base Rate - (Trust Score / 100 * (Base Rate - Min Rate))
  const personalizedRate = baseRate - (score / 100) * (baseRate - minRate);
  return personalizedRate;
}

export function getMaxBorrowAmount(score: number): number {
  // Logic: 10 XLM per point in the reputation score
  // 100 score = 1000 XLM max borrow
  return score * 10;
}
