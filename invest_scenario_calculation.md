i    - month num
u    - yearly inflation rate 0.025
t    - tax rate
r    - investment interest rate (consider as constant) 0.1
E    - initial equity used for buying the house
M(i) - savings from not paying mortgage (difference between mortgage and rent)
Y(i) - money saved by month i
A(i) - real adjusted purchase price of month i 
X(i) - net worth by month i (if selling portfolio at month i)
P(i) - month i mortgage payment
R(i) - month i rent payment

u = 0.025 (yearly → monthly: um = (1+u)^(1/12) - 1)
t = 0.25
r = 0.1    (yearly → monthly: rm = (1+r)^(1/12) - 1)
Y(1) = E
M(i) = P(i)-R(i)
Y(i) = Y(i-1)*(1+rm)+M(i)

A(i) - recursive calculation:
begin:
    A(0) = E
    for(i=1;i<=total_months;i++){
        A(i) = A(i-1)*(1+um) + M(i)
    }
end

X(i) = Y(i)-(Y(i)-A(i))*t



