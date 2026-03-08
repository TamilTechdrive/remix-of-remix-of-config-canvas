import { db } from './connection.js';
import { logger } from '../utils/logger.js';

export async function runMigration002() {
  // Enhanced data storage tables
  await db.schema.createTableIfNotExists('config_nodes', (table) => {
    table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    table.uuid('configuration_id').notNullable().references('id').inTable('configurations').onDelete('CASCADE');
    table.string('node_id').notNullable(); // react-flow node id
    table.string('node_type').notNullable(); // container, module, group, option
    table.string('label').notNullable();
    table.text('description');
    table.boolean('visible').defaultTo(true);
    table.boolean('included').defaultTo(null);
    table.jsonb('properties').defaultTo('{}');
    table.jsonb('position').defaultTo('{"x":0,"y":0}');
    table.string('visibility_rule');
    table.jsonb('validation_rules').defaultTo('[]');
    table.jsonb('user_rules').defaultTo('[]');
    table.string('impact_level').defaultTo('low');
    table.integer('priority').defaultTo(0);
    table.jsonb('tags').defaultTo('[]');
    table.boolean('must_enable').defaultTo(false);
    table.boolean('must_disable').defaultTo(false);
    table.string('color_tag');
    table.text('notes');
    table.timestamps(true, true);
    table.unique(['configuration_id', 'node_id']);
  });

  await db.schema.createTableIfNotExists('config_edges', (table) => {
    table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    table.uuid('configuration_id').notNullable().references('id').inTable('configurations').onDelete('CASCADE');
    table.string('edge_id').notNullable();
    table.string('source_node_id').notNullable();
    table.string('target_node_id').notNullable();
    table.string('edge_type').defaultTo('smoothstep');
    table.boolean('animated').defaultTo(true);
    table.jsonb('style').defaultTo('{}');
    table.timestamps(true, true);
    table.unique(['configuration_id', 'edge_id']);
  });

  await db.schema.createTableIfNotExists('config_snapshots', (table) => {
    table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    table.uuid('configuration_id').notNullable().references('id').inTable('configurations').onDelete('CASCADE');
    table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('snapshot_name').notNullable();
    table.text('description');
    table.jsonb('nodes_data').notNullable();
    table.jsonb('edges_data').notNullable();
    table.integer('node_count').defaultTo(0);
    table.integer('edge_count').defaultTo(0);
    table.timestamp('created_at').defaultTo(db.fn.now());
  });

  await db.schema.createTableIfNotExists('user_preferences', (table) => {
    table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE').unique();
    table.string('theme').defaultTo('dark');
    table.string('language').defaultTo('en');
    table.boolean('email_notifications').defaultTo(true);
    table.boolean('auto_save').defaultTo(true);
    table.integer('auto_save_interval').defaultTo(30);
    table.jsonb('editor_preferences').defaultTo('{}');
    table.jsonb('dashboard_layout').defaultTo('{}');
    table.timestamps(true, true);
  });

  logger.info('Migration 002 completed: Enhanced data storage tables created');
}
