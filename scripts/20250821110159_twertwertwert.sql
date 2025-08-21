-- Description: twertwertwert
--      Script: 20250821110159_twertwertwert.sql 
--   File name: 20250821110159
--  Created at: 21/08/2025 11:01
--      Author: joubert

CREATE TABLE IF NOT EXISTS tmp_brandsxxx(id SERIAL NOT NULL PRIMARY KEY,
                                                        brand_name VARCHAR(100) NOT NULL,
                                                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                                        updated_at TIMESTAMP,
                                                        deleted_at JSON)