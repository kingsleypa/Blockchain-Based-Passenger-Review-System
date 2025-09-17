# 🚗 Blockchain-Based Passenger Review System

Welcome to a decentralized solution for authentic passenger reviews in ride-sharing and transportation platforms! This project uses the Stacks blockchain and Clarity smart contracts to ensure transparent, immutable, and verified reviews, eliminating fake or manipulated ratings.

## ✨ Features

🔐 **User Registration**: Register passengers and drivers with unique identities.  
📝 **Review Submission**: Passengers submit reviews with ratings and comments, cryptographically signed for authenticity.  
✅ **Review Verification**: Verify the authenticity of reviews using blockchain records.  
⚖️ **Dispute Resolution**: Handle disputes over unfair reviews with a decentralized arbitration process.  
💰 **Incentive Mechanism**: Reward honest reviewers with tokens to encourage participation.  
🔍 **Transparency**: Publicly accessible review records for trust and accountability.  
🚫 **Fraud Prevention**: Prevent duplicate or fake reviews through hash-based verification.  
📊 **Analytics**: Aggregate ratings for drivers to provide trustworthy performance metrics.

## 🛠 How It Works

### For Passengers
1. **Register**: Call the `user-registry` contract to register as a passenger with a unique ID and public key.  
2. **Submit Review**: After a ride, use the `review-submission` contract to submit a review, including:
   - A SHA-256 hash of the ride details (e.g., ride ID, driver ID, timestamp).  
   - A rating (1–5 stars) and optional comments.  
   - A cryptographic signature to prove authenticity.  
3. **Earn Rewards**: Honest reviews earn tokens via the `reward-system` contract.  
4. **Dispute Reviews**: If a driver disputes a review, use the `dispute-resolution` contract to submit evidence for arbitration.

### For Drivers
1. **Register**: Register as a driver using the `user-registry` contract.  
2. **View Reviews**: Access your aggregated ratings and review details via the `review-analytics` contract.  
3. **Dispute Reviews**: Submit a dispute to the `dispute-resolution` contract if a review seems unfair.

### For Verifiers
1. **Verify Reviews**: Use the `review-verification` contract to check the authenticity of a review by validating the ride hash and signature.  
2. **Check Ratings**: Query the `review-analytics` contract for a driver’s average rating and review history.

### For Arbitrators
1. **Resolve Disputes**: Use the `dispute-resolution` contract to review evidence and vote on the validity of disputed reviews.

## 📂 Smart Contracts

The project consists of 8 Clarity smart contracts, each handling a specific functionality:

1. **user-registry.clar**: Manages passenger and driver registration, storing their public keys and IDs.  
2. **review-submission.clar**: Handles review submissions, including ride hash, rating, comments, and signature.  
3. **review-verification.clar**: Verifies review authenticity by checking the ride hash and signature.  
4. **dispute-resolution.clar**: Manages disputes, allowing drivers to challenge reviews and arbitrators to vote.  
5. **reward-system.clar**: Distributes tokens to passengers for submitting honest reviews.  
6. **review-analytics.clar**: Aggregates driver ratings and provides review statistics.  
7. **ride-registry.clar**: Stores ride details (e.g., ride ID, driver, passenger, timestamp) for verification.  
8. **access-control.clar**: Manages permissions and roles (e.g., passengers, drivers, arbitrators).

## 🛠 Setup and Deployment

1. **Prerequisites**:
   - Install the Stacks CLI and Clarity development environment.
   - Set up a Stacks wallet for deploying contracts and interacting with the blockchain.

2. **Deployment**:
   - Deploy the contracts in the following order: `user-registry`, `ride-registry`, `access-control`, `review-submission`, `review-verification`, `dispute-resolution`, `reward-system`, `review-analytics`.
   - Use the Stacks testnet for initial testing.

3. **Interacting with the System**:
   - Register users via the `user-registry` contract.
   - Submit ride details to the `ride-registry` contract.
   - Use a frontend (e.g., React with Stacks.js) to interact with the contracts for review submission, verification, and analytics.

## 🔐 Security Features
- **Immutable Reviews**: Reviews are timestamped and stored on the blockchain, preventing tampering.  
- **Signature Verification**: Cryptographic signatures ensure only authorized passengers submit reviews.  
- **Duplicate Prevention**: Ride hashes prevent multiple reviews for the same ride.  
- **Decentralized Arbitration**: Disputes are resolved by a pool of arbitrators, ensuring fairness.

## 🚀 Future Enhancements
- Add support for anonymous reviews with zero-knowledge proofs.  
- Integrate with external ride-sharing platforms via APIs.  
- Introduce a reputation system for arbitrators based on their voting history.

## 📜 License
MIT License