i       - month num (1-indexed)
u       - yearly inflation rate (used for madad only)
r_m     - monthly mortgage rate (annual / 12)
r_a     - annual appreciation rate
r_rent  - annual rent growth rate
t       - capital gains tax rate (mas shevach)
T       - holding period in months
H       - handover month (construction duration in months)
K       - total months = H + T
E       - initial equity
P_price - purchase price (discounted price target)
M_price - market price (used for appreciation base)

O       - one-time costs (madad + purchase tax + legal + upgrades + furniture)
L       - mortgage amount = (P_price - E) + O
N       - mortgage term in months (e.g. 30 years = 360)

Ins     - monthly insurance (starts at handover)
Hoa     - monthly HOA / maintenance (starts at handover)
SellPct - selling costs as fraction of sale price (e.g. 0.02 = 2%)
MortClosePct - early mortgage closure penalty (e.g. 0.01 = 1% of remaining balance)
Rent(i) - monthly rent paid (alternative housing cost)
Pmt     - monthly Shpitzer payment = PMT(L, r_m, N)

=== CONSTRUCTION PHASE (months 1..H) ===

You don't have the apartment yet, so:
  - You pay rent at your current residence
  - You pay mortgage interest on drawn balance (no principal in interest-only mode)
  - You do NOT pay insurance or HOA (no keys yet)

HousingCostA(i) = Rent(i) + constructionMortgagePayment(i)

ContractorDue(i):
    if H == 0: return 0
    if i == 1: return H == 1 ? P_price : P_price * signingPct
    if i <= H: return (P_price - P_price*signingPct) / (H - 1)
    return 0

OneTimeCostsDue(i):
    if H == 0: return i == 1 ? O : 0
    amount = 0
    if i == 1: amount += purchaseTax + legalFees + upgrades
    if 1 <= i <= H: amount += madad / H
    if i == H: amount += furniture
    return amount

DrawnBalance(i) - mortgage drawn so far
EquityRemaining - decrements as equity is spent
ContractorObligation(i) - unpaid contractor balance

homeEquity(i) = propertyValue(i) - DrawnBalance(i) - ContractorObligation(i)
propertyValue(i) = M_price * (1 + r_a)^(i/12)

netWorthA(i) = homeEquity(i)

=== POST-HANDOVER PHASE (months H+1..K) ===

You have the keys, so:
  - You stop paying rent (you live in the apartment)
  - You start paying insurance + HOA
  - You pay full Shpitzer mortgage payment

HousingCostA(i) = Pmt + Ins + Hoa

remainingBalance starts at L (after handover top-up)

Amortization step:
    interest(i)  = remainingBalance(i-1) * r_m
    principal(i) = min(remainingBalance(i-1), Pmt - interest(i))
    remainingBalance(i) = remainingBalance(i-1) - principal(i)
    mortgagePayment(i) = interest(i) + principal(i)

propertyValue(i) = M_price * (1 + r_a)^(i/12)
homeEquity(i) = propertyValue(i) - remainingBalance(i)

capitalGain(i) = propertyValue(i) - (P_price + O)

=== SELLING COSTS (deducted at sale) ===

salePrice       = propertyValue(K)
sellingCosts    = salePrice * SellPct
netSaleProceeds = salePrice - sellingCosts

=== EARLY MORTGAGE CLOSURE ===

When selling before the mortgage term ends, the bank charges a penalty
(קנס יציאה) — typically 0.1%-1% of the remaining balance.

mortgageClosePenalty = remainingBalance(K) * MortClosePct

=== CAPITAL GAINS TAX (mas shevach) ===

capitalGain = netSaleProceeds - (P_price + O)
masShevach  = exempt ? 0 : max(0, capitalGain) * t

=== NET WORTH AT END OF HOLDING ===

netWorthA(K) = homeEquity(K) - masShevach - sellingCosts - mortgageClosePenalty

=== SUMMARY ===

finalA = netWorthA(K)
