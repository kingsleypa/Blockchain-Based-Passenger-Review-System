(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-RATING u101)
(define-constant ERR-INVALID-COMMENT-LENGTH u102)
(define-constant ERR-INVALID-RIDE-HASH u103)
(define-constant ERR-INVALID-SIGNATURE u104)
(define-constant ERR-RIDE-NOT-FOUND u105)
(define-constant ERR-PASSENGER-NOT-REGISTERED u106)
(define-constant ERR-REVIEW-ALREADY-EXISTS u107)
(define-constant ERR-INVALID-TIMESTAMP u108)
(define-constant ERR-SIGNATURE-VERIFICATION-FAILED u109)
(define-constant ERR-REWARD-ISSUANCE-FAILED u110)
(define-constant ERR-INVALID-REVIEW-ID u111)
(define-constant ERR-DRIVER-NOT-REGISTERED u112)
(define-constant ERR-REVIEW-NOT-FOUND u113)
(define-constant ERR-INVALID-UPDATE-PARAM u114)
(define-constant ERR-UPDATE-NOT-ALLOWED u115)
(define-constant ERR-INVALID-STATUS u116)
(define-constant ERR-MAX-REVIEWS-EXCEEDED u117)
(define-constant ERR-INVALID-LOCATION u118)
(define-constant ERR-INVALID-CURRENCY u119)
(define-constant ERR-INVALID-REWARD-AMOUNT u120)

(define-data-var next-review-id uint u0)
(define-data-var max-reviews uint u100000)
(define-data-var submission-fee uint u100)
(define-data-var authority-contract (optional principal) none)
(define-data-var reward-amount uint u50)
(define-data-var active-status bool true)

(define-map reviews
  uint
  {
    ride-hash: (buff 32),
    passenger: principal,
    driver: principal,
    rating: uint,
    comment: (string-ascii 256),
    signature: (buff 64),
    timestamp: uint,
    status: bool,
    location: (string-ascii 100),
    currency: (string-ascii 20)
  }
)

(define-map reviews-by-ride-hash
  (buff 32)
  uint
)

(define-map reviews-by-driver
  principal
  (list 100 uint)
)

(define-map review-updates
  uint
  {
    update-rating: uint,
    update-comment: (string-ascii 256),
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-review (id uint))
  (map-get? reviews id)
)

(define-read-only (get-review-updates (id uint))
  (map-get? review-updates id)
)

(define-read-only (is-review-registered (ride-hash (buff 32)))
  (is-some (map-get? reviews-by-ride-hash ride-hash))
)

(define-read-only (get-reviews-by-driver (driver principal))
  (default-to (list) (map-get? reviews-by-driver driver))
)

(define-private (validate-rating (rating uint))
  (if (and (>= rating u1) (<= rating u5))
      (ok true)
      (err ERR-INVALID-RATING))
)

(define-private (validate-comment (comment (string-ascii 256)))
  (if (<= (len comment) u256)
      (ok true)
      (err ERR-INVALID-COMMENT-LENGTH))
)

(define-private (validate-ride-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-RIDE-HASH))
)

(define-private (validate-signature (sig (buff 64)))
  (if (is-eq (len sig) u64)
      (ok true)
      (err ERR-INVALID-SIGNATURE))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-location (loc (string-ascii 100)))
  (if (<= (len loc) u100)
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-currency (cur (string-ascii 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-private (verify-signature (hash (buff 32)) (sig (buff 64)) (pubkey (buff 33)))
  (secp256k1-verify hash sig pubkey)
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-NOT-AUTHORIZED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-reviews (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-NOT-AUTHORIZED))
    (var-set max-reviews new-max)
    (ok true)
  )
)

(define-public (set-submission-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-NOT-AUTHORIZED))
    (var-set submission-fee new-fee)
    (ok true)
  )
)

(define-public (set-reward-amount (new-amount uint))
  (begin
    (asserts! (> new-amount u0) (err ERR-INVALID-REWARD-AMOUNT))
    (asserts! (is-some (var-get authority-contract)) (err ERR-NOT-AUTHORIZED))
    (var-set reward-amount new-amount)
    (ok true)
  )
)

(define-public (submit-review
  (ride-hash (buff 32))
  (rating uint)
  (comment (string-ascii 256))
  (signature (buff 64))
  (location (string-ascii 100))
  (currency (string-ascii 20))
)
  (let (
        (next-id (var-get next-review-id))
        (current-max (var-get max-reviews))
        (authority (var-get authority-contract))
        (passenger tx-sender)
        (ride-details (unwrap! (contract-call? .ride-registry get-ride-details ride-hash) (err ERR-RIDE-NOT-FOUND)))
        (driver (get driver ride-details))
        (passenger-pubkey (unwrap! (contract-call? .user-registry get-user-pubkey passenger) (err ERR-PASSENGER-NOT-REGISTERED)))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-REVIEWS-EXCEEDED))
    (try! (validate-ride-hash ride-hash))
    (try! (validate-rating rating))
    (try! (validate-comment comment))
    (try! (validate-signature signature))
    (try! (validate-location location))
    (try! (validate-currency currency))
    (asserts! (is-none (map-get? reviews-by-ride-hash ride-hash)) (err ERR-REVIEW-ALREADY-EXISTS))
    (asserts! (is-some (contract-call? .user-registry get-user driver)) (err ERR-DRIVER-NOT-REGISTERED))
    (asserts! (verify-signature ride-hash signature passenger-pubkey) (err ERR-SIGNATURE-VERIFICATION-FAILED))
    (let ((authority-recipient (unwrap! authority (err ERR-NOT-AUTHORIZED))))
      (try! (stx-transfer? (var-get submission-fee) tx-sender authority-recipient))
    )
    (map-set reviews next-id
      {
        ride-hash: ride-hash,
        passenger: passenger,
        driver: driver,
        rating: rating,
        comment: comment,
        signature: signature,
        timestamp: block-height,
        status: true,
        location: location,
        currency: currency
      }
    )
    (map-set reviews-by-ride-hash ride-hash next-id)
    (map-set reviews-by-driver driver (cons next-id (default-to (list) (map-get? reviews-by-driver driver))))
    (var-set next-review-id (+ next-id u1))
    (try! (contract-call? .reward-system issue-reward passenger (var-get reward-amount)))
    (print { event: "review-submitted", id: next-id })
    (ok next-id)
  )
)

(define-public (update-review
  (review-id uint)
  (update-rating uint)
  (update-comment (string-ascii 256))
)
  (let ((review (map-get? reviews review-id)))
    (match review
      r
        (begin
          (asserts! (is-eq (get passenger r) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-rating update-rating))
          (try! (validate-comment update-comment))
          (map-set reviews review-id
            {
              ride-hash: (get ride-hash r),
              passenger: (get passenger r),
              driver: (get driver r),
              rating: update-rating,
              comment: update-comment,
              signature: (get signature r),
              timestamp: block-height,
              status: (get status r),
              location: (get location r),
              currency: (get currency r)
            }
          )
          (map-set review-updates review-id
            {
              update-rating: update-rating,
              update-comment: update-comment,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "review-updated", id: review-id })
          (ok true)
        )
      (err ERR-REVIEW-NOT-FOUND)
    )
  )
)

(define-public (get-review-count)
  (ok (var-get next-review-id))
)

(define-public (check-review-existence (ride-hash (buff 32)))
  (ok (is-review-registered ride-hash))
)