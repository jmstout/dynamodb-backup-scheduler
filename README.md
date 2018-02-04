# Unito DynamoDB Backup Scheduler

This modules creates a Lambda function to create on-demand DynamoDB
backups. It also creates a CloudWatch scheduled event to trigger the Lambda
function daily. The Lambda also makes sure to delete old backups.

## Installation
```sh
npm install -g serverless
```

```sh
npm install
```

## Configuration
Copy the file `env-example.yml` to `env.yml` and edit its content.

## AWS Credentials
Set up your AWS Credentials. Follow [these instructions](https://serverless.com/framework/docs/providers/aws/guide/credentials/). Easiest is to use [AWS profiles](https://docs.aws.amazon.com/cli/latest/userguide/cli-multiple-profiles.html). You can create a profile with the command:
```sh
$ aws configure --profile newAccount
```

and then use it by exporting:
```sh
export AWS_PROFILE=newAccount
```

or prefixing every serverless command with
```sh
AWS_PROFILE=newAccount serverless ...
```

## IAM Permissions
The IAM identity used to deploy requires several permissions. Start by creating
an IAM policy based on the content of
[this file](https://github.com/unitoio/dynamodb-backup-scheduler/blob/master/aws-policy.json).
You will need to replace <region> with the name of the AWS region and <account>
with your actual AWS account number.

Once you have added that policy, attach it to your user account (or to a group
your user is part of).

## Initial Deployment
```sh
serverless deploy -v
```

## Updating the Lambda function only
```sh
serverless deploy function -f backupDynamoDBTables
```

## Deleting
```sh
serverless remove -v
```
