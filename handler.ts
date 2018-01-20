import { DynamoDB } from 'aws-sdk';
import * as qs from 'qs';

const dynamoDb = new DynamoDB();

function batch(array: any[], size: number): any[][] {
  const result = [];
  let index = 0;

  while (index < array.length) {
    result.push(array.slice(index, index + size));
    index += size;
  }

  return result;
}

const makeLogCallback = (successMsg: string, errMsg: string) => (resolve, reject) => (err, data) => {
  if (err) {
    console.error(errMsg, err);
    resolve(err);
  }
  console.log(successMsg);
  resolve(data);
};

function createBackup(tableName: string, backupName: string): Promise<void> {
  const params = {
    TableName: tableName,
    BackupName: backupName,
  };
  const logCallback = makeLogCallback(
    `Backed up ${tableName}`,
    `Could not backup ${tableName}`,
  );
  return new Promise<void>((resolve, reject) => dynamoDb.createBackup(params, logCallback(resolve, reject)));
}

async function getBackupList(tableNames: string[], fromDate: Date, toDate: Date): Promise<DynamoDB.Types.BackupSummary[]> {
  const params = {
    TimeRangeLowerBound: fromDate,
    TimeRangeUpperBound: toDate,
  };
  const logCallback = makeLogCallback(
    `Got existing list of backups`,
    `Could not get list of backups`,
  );
  // TODO: handle multiple pages
  const allBackups: DynamoDB.Types.ListBackupsOutput = await new Promise(
    (resolve, reject) =>
      dynamoDb.listBackups(params, logCallback(resolve, reject)),
  );
  // return only the backup for our tables
  return allBackups.BackupSummaries
    .filter(summary => tableNames.includes(summary.TableName));
}

async function deleteBackup(backupArn: string, tableName: string): Promise<void> {
  const logCallback = makeLogCallback(
    `Deleted backup of ${tableName}: ${backupArn}`,
    `Could not delete backup of ${tableName} ${backupArn}`,
  );
  return new Promise<void>((resolve, reject) => dynamoDb.deleteBackup({
    BackupArn: backupArn,
  }, logCallback(resolve, reject)));
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
  const createBackupForTable = tableName => createBackup(tableName, backupName);
  const batchedTableNames = batch(tableNames, 50);
  for (const currentBatch of batchedTableNames) {
    console.log('...processing currentBatch', currentBatch);
    await Promise.all(currentBatch.map(createBackupForTable));
  }

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
