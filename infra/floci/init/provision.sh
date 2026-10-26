#!/bin/bash
set -euo pipefail

# Floci keeps state in memory, so this runs on every container start and must
# stay idempotent.

ENDPOINT=http://localhost:4566
BUS=investflow
aws() { command aws --endpoint-url "$ENDPOINT" "$@"; }

aws events describe-event-bus --name "$BUS" >/dev/null 2>&1 ||
  aws events create-event-bus --name "$BUS" >/dev/null

# Creates a FIFO consumer queue with its FIFO dead-letter queue and routes the
# events matching the pattern to it. Messages are grouped by aggregate, so one
# message per aggregate is in flight at a time; locally Floci does not evaluate
# the group path and the whole queue is one group. EventBridge sends no
# deduplication id, so FIFO queues need content-based deduplication. A message
# is dead-lettered after 5 failed receives.
consumer_queue() {
  local name=$1 pattern=$2
  local dlq_url dlq_arn queue_url queue_arn rule_arn

  dlq_url=$(aws sqs create-queue --queue-name "$name-dlq.fifo" \
    --attributes FifoQueue=true,ContentBasedDeduplication=true,MessageRetentionPeriod=1209600 \
    --query QueueUrl --output text)
  dlq_arn=$(aws sqs get-queue-attributes --queue-url "$dlq_url" \
    --attribute-names QueueArn --query Attributes.QueueArn --output text)

  queue_url=$(aws sqs create-queue --queue-name "$name.fifo" \
    --attributes FifoQueue=true,ContentBasedDeduplication=true \
    --query QueueUrl --output text)
  queue_arn=$(aws sqs get-queue-attributes --queue-url "$queue_url" \
    --attribute-names QueueArn --query Attributes.QueueArn --output text)

  rule_arn=$(aws events put-rule --name "$name" --event-bus-name "$BUS" \
    --event-pattern "$pattern" --query RuleArn --output text)

  aws sqs set-queue-attributes --queue-url "$queue_url" --attributes "$(
    cat <<JSON
{
  "VisibilityTimeout": "30",
  "RedrivePolicy": "{\"deadLetterTargetArn\":\"$dlq_arn\",\"maxReceiveCount\":\"5\"}",
  "Policy": "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"events.amazonaws.com\"},\"Action\":\"sqs:SendMessage\",\"Resource\":\"$queue_arn\",\"Condition\":{\"ArnEquals\":{\"aws:SourceArn\":\"$rule_arn\"}}}]}"
}
JSON
  )"

  aws events put-targets --rule "$name" --event-bus-name "$BUS" \
    --targets "$(
      cat <<JSON
[{"Id": "$name", "Arn": "$queue_arn", "SqsParameters": {"MessageGroupId": "\$.detail.aggregateId"}}]
JSON
    )" >/dev/null
}

consumer_queue simulation-calculations \
  '{"source":["investflow.investment-simulator"],"detail-type":["SimulationCreated","SimulationEdited","SimulationCalculationRequested"]}'
