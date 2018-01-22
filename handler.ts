import { DynamoDB } from 'aws-sdk';
import * as qs from 'qs';
import * as Bluebird from 'bluebird';

const dynamoDb = new DynamoDB();

async function createBackup(tableName: string, backupName: string): Promise<void> {
  try {
    await dynamoDb.createBackup({
      TableName: tableName,
      BackupName: backupName,
    }).promise();
    console.log(`Backed up ${tableName}`);
  } catch (err) {
    console.error(`Could not backup ${tableName}`, err);
  }
}

async function getBackupList(
  tableNames: string[],
  fromDate: Date,
  toDate: Date,
): Promise<DynamoDB.Types.BackupSummary[]> {
  // TODO: handle multiple pages
  try {
    const allBackups: DynamoDB.Types.ListBackupsOutput =
      await dynamoDb.listBackups({
        TimeRangeLowerBound: fromDate,
        TimeRangeUpperBound: toDate,
      }).promise();
    console.log('Got existing list of backups');
    // return only the backup for our tables
    return allBackups.BackupSummaries
      .filter(summary => tableNames.includes(summary.TableName));
  } catch (err) {
    console.error('Could not get list of backups:', err);
  }
}

async function deleteBackup(backupArn: string, tableName: string): Promise<void> {
  try {
    await dynamoDb.deleteBackup({
      BackupArn: backupArn,
    }).promise();
    console.log(`Deleted backup of ${tableName}: ${backupArn}`);
  } catch (err) {
    console.error(`Could not delete backup of ${tableName} ${backupArn}`, err);
  }
}


/**
 * main function
 */
export async function backupDynamoDBTables(event, context, callback): Promise<void> {
  const now = Date.now();

  const { backupName, tableNames, retention } = qs.parse(event);
  console.log('Handling event', event);

  // backup all the tables in parallel, 50 at time.
  // CreateBackup can be called at a maximum rate of 50 times per second.
  await Bluebird.map(
    tableNames,
    (tableName: string) => createBackup(tableName, backupName),
    { concurrency: 50 },
  );

  // remove old backups
  const fromDate = new Date('2017-01-01');
  const toDate = new Date(Date.now() - retention * 24 * 60 * 60 * 1000);
  const expiredBackups = await getBackupList(tableNames, fromDate, toDate);

  // DeleteBackup has a maximum rate of 10 times per second. Do one at a time.
  for (const backup of expiredBackups) {
    await deleteBackup(backup.BackupArn, backup.TableName);
  }

  callback(null, { statusCode: 200 });
}
