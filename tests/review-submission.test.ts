import { describe, it, expect, beforeEach } from "vitest";
import { buffCV, stringAsciiCV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_RATING = 101;
const ERR_INVALID_COMMENT_LENGTH = 102;
const ERR_INVALID_RIDE_HASH = 103;
const ERR_INVALID_SIGNATURE = 104;
const ERR_RIDE_NOT_FOUND = 105;
const ERR_PASSENGER_NOT_REGISTERED = 106;
const ERR_REVIEW_ALREADY_EXISTS = 107;
const ERR_SIGNATURE_VERIFICATION_FAILED = 109;
const ERR_DRIVER_NOT_REGISTERED = 112;
const ERR_REVIEW_NOT_FOUND = 113;
const ERR_INVALID_UPDATE_PARAM = 114;
const ERR_MAX_REVIEWS_EXCEEDED = 117;
const ERR_INVALID_LOCATION = 118;
const ERR_INVALID_CURRENCY = 119;
const ERR_INVALID_REWARD_AMOUNT = 120;

interface Review {
  rideHash: Uint8Array;
  passenger: string;
  driver: string;
  rating: number;
  comment: string;
  signature: Uint8Array;
  timestamp: number;
  status: boolean;
  location: string;
  currency: string;
}

interface ReviewUpdate {
  updateRating: number;
  updateComment: string;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

interface RideDetails {
  driver: string;
}

class ReviewSubmissionMock {
  state: {
    nextReviewId: number;
    maxReviews: number;
    submissionFee: number;
    authorityContract: string | null;
    rewardAmount: number;
    activeStatus: boolean;
    reviews: Map<number, Review>;
    reviewsByRideHash: Map<string, number>;
    reviewsByDriver: Map<string, number[]>;
    reviewUpdates: Map<number, ReviewUpdate>;
  } = {
    nextReviewId: 0,
    maxReviews: 100000,
    submissionFee: 100,
    authorityContract: null,
    rewardAmount: 50,
    activeStatus: true,
    reviews: new Map(),
    reviewsByRideHash: new Map(),
    reviewsByDriver: new Map(),
    reviewUpdates: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];
  rideRegistry: Map<string, RideDetails> = new Map();
  userRegistry: Map<string, { pubkey: Uint8Array }> = new Map();
  driverRegistry: Set<string> = new Set();
  rewardsIssued: Array<{ to: string; amount: number }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextReviewId: 0,
      maxReviews: 100000,
      submissionFee: 100,
      authorityContract: null,
      rewardAmount: 50,
      activeStatus: true,
      reviews: new Map(),
      reviewsByRideHash: new Map(),
      reviewsByDriver: new Map(),
      reviewUpdates: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
    this.rideRegistry = new Map();
    this.userRegistry = new Map();
    this.driverRegistry = new Set();
    this.rewardsIssued = [];
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setSubmissionFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.submissionFee = newFee;
    return { ok: true, value: true };
  }

  setRewardAmount(newAmount: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newAmount <= 0) return { ok: false, value: ERR_INVALID_REWARD_AMOUNT };
    this.state.rewardAmount = newAmount;
    return { ok: true, value: true };
  }

  getRideDetails(rideHash: Uint8Array): RideDetails | null {
    return this.rideRegistry.get(rideHash.toString()) || null;
  }

  getUserPubkey(user: string): Uint8Array | null {
    const entry = this.userRegistry.get(user);
    return entry ? entry.pubkey : null;
  }

  isDriverRegistered(driver: string): boolean {
    return this.driverRegistry.has(driver);
  }

  verifySignature(hash: Uint8Array, sig: Uint8Array, pubkey: Uint8Array): boolean {
    return true;
  }

  issueReward(to: string, amount: number): Result<boolean> {
    this.rewardsIssued.push({ to, amount });
    return { ok: true, value: true };
  }

  submitReview(
    rideHash: Uint8Array,
    rating: number,
    comment: string,
    signature: Uint8Array,
    location: string,
    currency: string
  ): Result<number> {
    if (this.state.nextReviewId >= this.state.maxReviews) return { ok: false, value: ERR_MAX_REVIEWS_EXCEEDED };
    if (rideHash.length !== 32) return { ok: false, value: ERR_INVALID_RIDE_HASH };
    if (rating < 1 || rating > 5) return { ok: false, value: ERR_INVALID_RATING };
    if (comment.length > 256) return { ok: false, value: ERR_INVALID_COMMENT_LENGTH };
    if (signature.length !== 64) return { ok: false, value: ERR_INVALID_SIGNATURE };
    if (location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    const rideHashStr = rideHash.toString();
    if (this.state.reviewsByRideHash.has(rideHashStr)) return { ok: false, value: ERR_REVIEW_ALREADY_EXISTS };
    const rideDetails = this.getRideDetails(rideHash);
    if (!rideDetails) return { ok: false, value: ERR_RIDE_NOT_FOUND };
    const driver = rideDetails.driver;
    if (!this.isDriverRegistered(driver)) return { ok: false, value: ERR_DRIVER_NOT_REGISTERED };
    const pubkey = this.getUserPubkey(this.caller);
    if (!pubkey) return { ok: false, value: ERR_PASSENGER_NOT_REGISTERED };
    if (!this.verifySignature(rideHash, signature, pubkey)) return { ok: false, value: ERR_SIGNATURE_VERIFICATION_FAILED };
    if (!this.state.authorityContract) return { ok: false, value: ERR_NOT_AUTHORIZED };

    this.stxTransfers.push({ amount: this.state.submissionFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextReviewId;
    const review: Review = {
      rideHash,
      passenger: this.caller,
      driver,
      rating,
      comment,
      signature,
      timestamp: this.blockHeight,
      status: true,
      location,
      currency,
    };
    this.state.reviews.set(id, review);
    this.state.reviewsByRideHash.set(rideHashStr, id);
    let driverReviews = this.state.reviewsByDriver.get(driver) || [];
    driverReviews = [...driverReviews, id];
    this.state.reviewsByDriver.set(driver, driverReviews);
    this.state.nextReviewId++;
    this.issueReward(this.caller, this.state.rewardAmount);
    return { ok: true, value: id };
  }

  getReview(id: number): Review | null {
    return this.state.reviews.get(id) || null;
  }

  updateReview(id: number, updateRating: number, updateComment: string): Result<boolean> {
    const review = this.state.reviews.get(id);
    if (!review) return { ok: false, value: ERR_REVIEW_NOT_FOUND };
    if (review.passenger !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (updateRating < 1 || updateRating > 5) return { ok: false, value: ERR_INVALID_RATING };
    if (updateComment.length > 256) return { ok: false, value: ERR_INVALID_COMMENT_LENGTH };

    const updated: Review = {
      ...review,
      rating: updateRating,
      comment: updateComment,
      timestamp: this.blockHeight,
    };
    this.state.reviews.set(id, updated);
    this.state.reviewUpdates.set(id, {
      updateRating,
      updateComment,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getReviewCount(): Result<number> {
    return { ok: true, value: this.state.nextReviewId };
  }

  checkReviewExistence(rideHash: Uint8Array): Result<boolean> {
    return { ok: true, value: this.state.reviewsByRideHash.has(rideHash.toString()) };
  }

  getReviewsByDriver(driver: string): number[] {
    return this.state.reviewsByDriver.get(driver) || [];
  }
}

describe("ReviewSubmission", () => {
  let contract: ReviewSubmissionMock;

  beforeEach(() => {
    contract = new ReviewSubmissionMock();
    contract.reset();
  });

  it("submits a review successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const rideHash = new Uint8Array(32).fill(1);
    const signature = new Uint8Array(64).fill(2);
    contract.rideRegistry.set(rideHash.toString(), { driver: "ST3DRIVER" });
    contract.userRegistry.set("ST1TEST", { pubkey: new Uint8Array(33).fill(3) });
    contract.driverRegistry.add("ST3DRIVER");
    const result = contract.submitReview(rideHash, 4, "Good ride", signature, "CityA", "STX");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const review = contract.getReview(0);
    expect(review?.rating).toBe(4);
    expect(review?.comment).toBe("Good ride");
    expect(review?.location).toBe("CityA");
    expect(review?.currency).toBe("STX");
    expect(contract.stxTransfers).toEqual([{ amount: 100, from: "ST1TEST", to: "ST2TEST" }]);
    expect(contract.rewardsIssued).toEqual([{ to: "ST1TEST", amount: 50 }]);
  });

  it("rejects duplicate reviews", () => {
    contract.setAuthorityContract("ST2TEST");
    const rideHash = new Uint8Array(32).fill(1);
    const signature = new Uint8Array(64).fill(2);
    contract.rideRegistry.set(rideHash.toString(), { driver: "ST3DRIVER" });
    contract.userRegistry.set("ST1TEST", { pubkey: new Uint8Array(33).fill(3) });
    contract.driverRegistry.add("ST3DRIVER");
    contract.submitReview(rideHash, 4, "Good ride", signature, "CityA", "STX");
    const result = contract.submitReview(rideHash, 3, "Okay ride", signature, "CityB", "USD");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_REVIEW_ALREADY_EXISTS);
  });

  it("rejects invalid rating", () => {
    contract.setAuthorityContract("ST2TEST");
    const rideHash = new Uint8Array(32).fill(1);
    const signature = new Uint8Array(64).fill(2);
    contract.rideRegistry.set(rideHash.toString(), { driver: "ST3DRIVER" });
    contract.userRegistry.set("ST1TEST", { pubkey: new Uint8Array(33).fill(3) });
    contract.driverRegistry.add("ST3DRIVER");
    const result = contract.submitReview(rideHash, 6, "Bad ride", signature, "CityA", "STX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_RATING);
  });

  it("rejects invalid ride hash length", () => {
    contract.setAuthorityContract("ST2TEST");
    const rideHash = new Uint8Array(31).fill(1);
    const signature = new Uint8Array(64).fill(2);
    const result = contract.submitReview(rideHash, 4, "Good ride", signature, "CityA", "STX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_RIDE_HASH);
  });

  it("rejects ride not found", () => {
    contract.setAuthorityContract("ST2TEST");
    const rideHash = new Uint8Array(32).fill(1);
    const signature = new Uint8Array(64).fill(2);
    contract.userRegistry.set("ST1TEST", { pubkey: new Uint8Array(33).fill(3) });
    const result = contract.submitReview(rideHash, 4, "Good ride", signature, "CityA", "STX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_RIDE_NOT_FOUND);
  });

  it("rejects passenger not registered", () => {
    contract.setAuthorityContract("ST2TEST");
    const rideHash = new Uint8Array(32).fill(1);
    const signature = new Uint8Array(64).fill(2);
    contract.rideRegistry.set(rideHash.toString(), { driver: "ST3DRIVER" });
    contract.driverRegistry.add("ST3DRIVER");
    const result = contract.submitReview(rideHash, 4, "Good ride", signature, "CityA", "STX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PASSENGER_NOT_REGISTERED);
  });

  it("rejects driver not registered", () => {
    contract.setAuthorityContract("ST2TEST");
    const rideHash = new Uint8Array(32).fill(1);
    const signature = new Uint8Array(64).fill(2);
    contract.rideRegistry.set(rideHash.toString(), { driver: "ST3DRIVER" });
    contract.userRegistry.set("ST1TEST", { pubkey: new Uint8Array(33).fill(3) });
    const result = contract.submitReview(rideHash, 4, "Good ride", signature, "CityA", "STX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_DRIVER_NOT_REGISTERED);
  });

  it("updates a review successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const rideHash = new Uint8Array(32).fill(1);
    const signature = new Uint8Array(64).fill(2);
    contract.rideRegistry.set(rideHash.toString(), { driver: "ST3DRIVER" });
    contract.userRegistry.set("ST1TEST", { pubkey: new Uint8Array(33).fill(3) });
    contract.driverRegistry.add("ST3DRIVER");
    contract.submitReview(rideHash, 4, "Good ride", signature, "CityA", "STX");
    const result = contract.updateReview(0, 5, "Excellent ride");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const review = contract.getReview(0);
    expect(review?.rating).toBe(5);
    expect(review?.comment).toBe("Excellent ride");
    const update = contract.state.reviewUpdates.get(0);
    expect(update?.updateRating).toBe(5);
    expect(update?.updateComment).toBe("Excellent ride");
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent review", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateReview(99, 5, "Excellent ride");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_REVIEW_NOT_FOUND);
  });

  it("rejects update by non-passenger", () => {
    contract.setAuthorityContract("ST2TEST");
    const rideHash = new Uint8Array(32).fill(1);
    const signature = new Uint8Array(64).fill(2);
    contract.rideRegistry.set(rideHash.toString(), { driver: "ST3DRIVER" });
    contract.userRegistry.set("ST1TEST", { pubkey: new Uint8Array(33).fill(3) });
    contract.driverRegistry.add("ST3DRIVER");
    contract.submitReview(rideHash, 4, "Good ride", signature, "CityA", "STX");
    contract.caller = "ST4FAKE";
    const result = contract.updateReview(0, 5, "Excellent ride");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("sets submission fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setSubmissionFee(200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.submissionFee).toBe(200);
  });

  it("rejects submission fee change without authority", () => {
    const result = contract.setSubmissionFee(200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct review count", () => {
    contract.setAuthorityContract("ST2TEST");
    const rideHash1 = new Uint8Array(32).fill(1);
    const rideHash2 = new Uint8Array(32).fill(4);
    const signature = new Uint8Array(64).fill(2);
    contract.rideRegistry.set(rideHash1.toString(), { driver: "ST3DRIVER" });
    contract.rideRegistry.set(rideHash2.toString(), { driver: "ST3DRIVER" });
    contract.userRegistry.set("ST1TEST", { pubkey: new Uint8Array(33).fill(3) });
    contract.driverRegistry.add("ST3DRIVER");
    contract.submitReview(rideHash1, 4, "Good ride", signature, "CityA", "STX");
    contract.submitReview(rideHash2, 5, "Excellent", signature, "CityB", "USD");
    const result = contract.getReviewCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks review existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const rideHash = new Uint8Array(32).fill(1);
    const signature = new Uint8Array(64).fill(2);
    contract.rideRegistry.set(rideHash.toString(), { driver: "ST3DRIVER" });
    contract.userRegistry.set("ST1TEST", { pubkey: new Uint8Array(33).fill(3) });
    contract.driverRegistry.add("ST3DRIVER");
    contract.submitReview(rideHash, 4, "Good ride", signature, "CityA", "STX");
    const result = contract.checkReviewExistence(rideHash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const fakeHash = new Uint8Array(32).fill(5);
    const result2 = contract.checkReviewExistence(fakeHash);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("gets reviews by driver correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const rideHash1 = new Uint8Array(32).fill(1);
    const rideHash2 = new Uint8Array(32).fill(4);
    const signature = new Uint8Array(64).fill(2);
    contract.rideRegistry.set(rideHash1.toString(), { driver: "ST3DRIVER" });
    contract.rideRegistry.set(rideHash2.toString(), { driver: "ST3DRIVER" });
    contract.userRegistry.set("ST1TEST", { pubkey: new Uint8Array(33).fill(3) });
    contract.driverRegistry.add("ST3DRIVER");
    contract.submitReview(rideHash1, 4, "Good ride", signature, "CityA", "STX");
    contract.submitReview(rideHash2, 5, "Excellent", signature, "CityB", "USD");
    const reviews = contract.getReviewsByDriver("ST3DRIVER");
    expect(reviews).toEqual([0, 1]);
  });

  it("sets reward amount successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setRewardAmount(100);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.rewardAmount).toBe(100);
  });

  it("rejects invalid reward amount", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setRewardAmount(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_REWARD_AMOUNT);
  });

  it("parses review parameters with Clarity types", () => {
    const comment = stringAsciiCV("Great ride");
    const rating = uintCV(5);
    expect(comment.value).toBe("Great ride");
    expect(rating.value).toEqual(BigInt(5));
  });

  it("rejects submission with max reviews exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxReviews = 1;
    const rideHash1 = new Uint8Array(32).fill(1);
    const rideHash2 = new Uint8Array(32).fill(4);
    const signature = new Uint8Array(64).fill(2);
    contract.rideRegistry.set(rideHash1.toString(), { driver: "ST3DRIVER" });
    contract.rideRegistry.set(rideHash2.toString(), { driver: "ST3DRIVER" });
    contract.userRegistry.set("ST1TEST", { pubkey: new Uint8Array(33).fill(3) });
    contract.driverRegistry.add("ST3DRIVER");
    contract.submitReview(rideHash1, 4, "Good ride", signature, "CityA", "STX");
    const result = contract.submitReview(rideHash2, 5, "Excellent", signature, "CityB", "USD");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_REVIEWS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});