const {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
} = require("@aws-sdk/client-dynamodb");
const { byStartAsc, normalizeItem } = require("./common");

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || process.env.RESERVATIONS_TABLE_NAME;
const dynamodb = new DynamoDBClient({});

function requireTableName() {
  if (!TABLE_NAME) {
    throw new Error("DYNAMODB_TABLE_NAME is not set.");
  }
}

function toAttributeMap(item) {
  return {
    id: { S: item.id },
    room: { S: item.room },
    startAt: { S: item.startAt },
    endAt: { S: item.endAt },
    purpose: { S: item.purpose },
    booker: { S: item.booker },
    createdAt: { S: item.createdAt },
    deletePinHash: { S: item.deletePinHash || "" },
  };
}

function fromAttributeMap(item) {
  return normalizeItem({
    id: item.id && item.id.S,
    room: item.room && item.room.S,
    startAt: item.startAt && item.startAt.S,
    endAt: item.endAt && item.endAt.S,
    purpose: item.purpose && item.purpose.S,
    booker: item.booker && item.booker.S,
    deletePinHash: item.deletePinHash && item.deletePinHash.S,
    createdAt: item.createdAt && item.createdAt.S,
  });
}

async function scanAll(params) {
  requireTableName();

  const items = [];
  let ExclusiveStartKey;
  do {
    const response = await dynamodb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        ...params,
        ExclusiveStartKey,
      }),
    );

    items.push(...(response.Items || []).map(fromAttributeMap));
    ExclusiveStartKey = response.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items;
}

async function listReservations() {
  const items = await scanAll();
  return items.filter((item) => item.room).sort(byStartAsc);
}

async function listReservationsByRoom(room) {
  const items = await scanAll({
    FilterExpression: "#room = :room",
    ExpressionAttributeNames: {
      "#room": "room",
    },
    ExpressionAttributeValues: {
      ":room": { S: room },
    },
  });

  return items.sort(byStartAsc);
}

async function createReservation(item) {
  requireTableName();

  await dynamodb.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: toAttributeMap(item),
      ConditionExpression: "attribute_not_exists(id)",
    }),
  );

  return item;
}

async function updateReservation(item) {
  requireTableName();

  await dynamodb.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: toAttributeMap(item),
      ConditionExpression: "attribute_exists(id)",
    }),
  );

  return item;
}

async function getReservation(id) {
  requireTableName();

  const response = await dynamodb.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: {
        id: { S: id },
      },
    }),
  );

  return response.Item ? fromAttributeMap(response.Item) : null;
}

async function deleteReservation(id) {
  requireTableName();

  const response = await dynamodb.send(
    new DeleteItemCommand({
      TableName: TABLE_NAME,
      Key: {
        id: { S: id },
      },
      ReturnValues: "ALL_OLD",
    }),
  );

  return Boolean(response.Attributes);
}

module.exports = {
  createReservation,
  deleteReservation,
  getReservation,
  listReservations,
  listReservationsByRoom,
  updateReservation,
};
