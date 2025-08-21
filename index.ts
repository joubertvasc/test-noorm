import { createConnection } from "jv-noorm";

(async () => {
  // Create the connection based on .env informations
  const db = createConnection();

  try {
    try {
      // Make the database connection;
      await db.connect();

      // The EXEC function should be used to run commands without results, like CREATE, DROP...
      // For this example we will create two temp tables: tmp_brands and tmp_models
      await db.exec({
        command: `CREATE TABLE IF NOT EXISTS tmp_brands(id SERIAL NOT NULL PRIMARY KEY,
                                                        brand_name VARCHAR(100) NOT NULL,
                                                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                                        updated_at TIMESTAMP,
                                                        deleted_at JSON)`,
      });

      await db.exec({
        command: `CREATE TABLE IF NOT EXISTS tmp_models(id SERIAL NOT NULL PRIMARY KEY,
                                                        brand_id INT NOT NULL,
                                                        model_name VARCHAR(100) NOT NULL,
                                                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                                        updated_at TIMESTAMP,
                                                        deleted_at JSON,
                                                        FOREIGN KEY (brand_id) REFERENCES tmp_brands (id) ON DELETE CASCADE)`,
      });

      // Inserting things into tables without transactions
      const brandInserted = await db.insert({
        command: `INSERT INTO tmp_brands(brand_name) VALUES ($1) RETURNING id`,
        values: ['Ford'],
      });
      // This will return the object:
      // rowsInserted: the number of new rows inserted
      // id: if the table has an auto_increment primary key and the insert command shoud insert just one row,
      // the new value will be here
      console.log(brandInserted);

      const modelInserted = await db.insert({
        command: `INSERT INTO tmp_models(brand_id, model_name) VALUES ($1, $2) RETURNING id`,
        values: [brandInserted.id, 'Fiesta'],
      });
      console.log(modelInserted);

      // Using Transactions
      const transaction = await db.startTransaction();
      try {
        const otherBrandInserted = await db.insert({
          command: `INSERT INTO tmp_brands(brand_name) VALUES ($1) RETURNING id`,
          values: ['Fiat'],
          transaction,
        });
        await db.insert({
          command: `INSERT INTO tmp_models(brand_id, model_name) VALUES ($1, $2) RETURNING id`,
          values: [otherBrandInserted.id, 'Fiat 500'],
          transaction,
        });
        await db.insert({
          command: `INSERT INTO tmp_models(brand_id, model_name) VALUES ($1, $2) RETURNING id`,
          values: [otherBrandInserted.id, 'Panda'],
          transaction,
        });
        await db.insert({
          command: `INSERT INTO tmp_models(brand_id, model_name) VALUES ($1, $2) RETURNING id`,
          values: [otherBrandInserted.id, 'Fastback'],
          transaction,
        });

        await db.commit(transaction);
      } catch (err: any) {
        await db.rollback(transaction);
        throw new Error(err);
      }

      // Let's see if the rows was correctly inserted
      // The QUERYROWS function will always return an array of objects
      const rowsInserted = await db.queryRows({
        sql: `SELECT B.*, M.*
                FROM tmp_brands B
                JOIN tmp_models M ON M.brand_id = B.id
               ORDER BY B.brand_name, M.model_name`,
      });

      console.log(rowsInserted);

      // If we want only one ROW, we should use QUERYROW. This function returns an object only:
      const ford = await db.queryRow({
        sql: `SELECT *
                FROM tmp_brands B
               WHERE B.id = $1`,
        values: [1],
      });

      console.log(ford);

      // Now we will update something.
      // The UPDATE function returns an object with the number of affeted rows in rowsUpdated
      const updateResult = await db.update({
        command: `UPDATE tmp_models
                     SET model_name = $1
                   WHERE model_name = $2`,
        values: ['Cronos', 'Panda'],
      });

      console.log(updateResult);

      // Now we will update something.
      // The DELETE function returns an object with the number of affeted rows in rowsDeleted
      const deleteResult = await db.delete({
        command: `DELETE FROM tmp_models
                   WHERE id = $1`,
        values: [2],
      });

      console.log(deleteResult);

      // Let's see the database again
      const afterOperations = await db.queryRows({
        sql: `SELECT B.*, M.*
                FROM tmp_brands B
                JOIN tmp_models M ON M.brand_id = B.id
               ORDER BY B.brand_name, M.model_name`,
      });

      console.log(afterOperations);

      // Let's force a ROLLBACK, to see if the transaction is OK
      const secondTransaction = await db.startTransaction();
      try {
        const ferrariBrandInserted = await db.insert({
          command: `INSERT INTO tmp_brands(brand_name) VALUES ($1) RETURNING id`,
          values: ['Ferrari'],
          transaction: secondTransaction,
        });
        await db.insert({
          command: `INSERT INTO tmp_models(brand_id, model_name) VALUES ($1, $2) RETURNING id`,
          values: [ferrariBrandInserted.id, '296 GTB'],
          transaction: secondTransaction,
        });

        // This command is wrong
        await db.insert({
          command: `INSERT INTO tmp_models(brand_id, model_name) VALUES ($1) RETURNING id`,
          values: [ferrariBrandInserted.id, 'F40'],
          transaction: secondTransaction,
        });

        await db.commit(secondTransaction);
      } catch (err: any) {
        // This example should rollback
        await db.rollback(secondTransaction);

        console.log(err.message);
      }

      const ferrari = await db.queryRow({
        sql: `SELECT *
                FROM tmp_brands B
               WHERE B.id = $1`,
        values: [3],
      });

      // Should print UNDEFINED in console
      console.log(ferrari);

      // Let's talk about SOFTDELETE.
      // There are two ways you can softdelete a record:
      // 1 - If your entire database uses softdelete, set the DB object to use softdelete
      // 2 - You can pass an option to the DELETE function to use softdelete or not.

      // Method 1
      db.setSoftDelete(true);
      await db.delete({ command: 'DELETE FROM tmp_brands WHERE id = $1', values: [1] });

      // Method 2
      db.setSoftDelete(false); // To revert previous set
      await db.delete({
        command: 'DELETE FROM tmp_models WHERE id = $1',
        values: [3],
        options: {
          softDelete: true,
        },
      });

      // Both Methods will replace deleted_at field with the date of the exclusion instead of remove it from table.
      // You can remove the soft deleted record from your query, adding the condition 'deleted_at IS NULL'. Let's see:
      const withoutSoftDeleted = await db.queryRows({
        sql: `SELECT *
                FROM tmp_brands B
               WHERE B.deleted_at IS NULL`,
      });

      console.log(withoutSoftDeleted);

      const withoutSoftDeleted2 = await db.queryRows({
        sql: `SELECT *
                FROM tmp_models M
               WHERE M.deleted_at IS NULL`,
      });

      console.log(withoutSoftDeleted2);

      // In addiction, for auditing purpose, you can identify the user (using methods 1 or 2):
      await db.delete({
        command: 'DELETE FROM tmp_models WHERE id = $1',
        values: [4],
        options: {
          softDelete: true,
          userId: 1,
          userName: 'John Doe',
        },
      });

      // Let's see only the soft deleted models
      const softdeleted = await db.queryRows({
        sql: `SELECT *
                FROM tmp_models M
               WHERE M.deleted_at IS NOT NULL`,
      });

      console.log(softdeleted);
    } catch (err: any) {
      console.log(err.message);

      process.exit(1);
    }
  } finally {
    // Ok, everything tested, let's drop the temp tables
    await db.exec({ command: `DROP TABLE tmp_models` });
    await db.exec({ command: `DROP TABLE tmp_brands` });

    // Let's close the connection;
    db.close();

    process.exit(0);
  }
})();
