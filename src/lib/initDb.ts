import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { CHANGELOG } from "@/data/changelog";
import { DEFAULT_ROLE_PERMISSIONS } from "@/data/nav";

let initialized = false;

export async function initDb() {
  if (initialized) return;

  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\`            INT NOT NULL AUTO_INCREMENT,
        \`email\`         VARCHAR(200) NOT NULL,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`name\`          VARCHAR(200) NULL,
        \`role\`          VARCHAR(20) NOT NULL DEFAULT 'user',
        \`status\`        VARCHAR(20) NOT NULL DEFAULT 'pending',
        \`theme\`         VARCHAR(10) NOT NULL DEFAULT 'dark',
        \`created_at\`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`users_email_key\` (\`email\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    const avatarExists = await prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar'
    `;
    if (Number(avatarExists[0].cnt) === 0) {
      await prisma.$executeRaw`
        ALTER TABLE \`users\` ADD COLUMN \`avatar\` SMALLINT NULL DEFAULT NULL
      `;
    }

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`audit_logs\` (
        \`id\`          INT NOT NULL AUTO_INCREMENT,
        \`user_id\`     INT NULL,
        \`action\`      VARCHAR(50) NOT NULL,
        \`resource\`    VARCHAR(100) NOT NULL,
        \`resource_id\` VARCHAR(100) NULL,
        \`details\`     TEXT NULL,
        \`ip\`          VARCHAR(45) NULL,
        \`created_at\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`audit_logs_user_id_fk\` (\`user_id\`),
        CONSTRAINT \`audit_logs_user_id_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`feature_flags\` (
        \`key\`         VARCHAR(50) NOT NULL,
        \`enabled\`     TINYINT(1) NOT NULL DEFAULT 1,
        \`label\`       VARCHAR(100) NOT NULL,
        \`description\` VARCHAR(255) NOT NULL,
        PRIMARY KEY (\`key\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`changelog\` (
        \`id\`          INT NOT NULL AUTO_INCREMENT,
        \`date\`        DATE NOT NULL,
        \`description\` TEXT NOT NULL,
        \`created_at\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`changelog_unique\` (\`date\`, \`description\`(200))
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    // Sync changelog entries from static data
    for (const entry of CHANGELOG) {
      await prisma.$executeRaw`
        INSERT IGNORE INTO changelog (\`date\`, description)
        VALUES (${entry.date}, ${entry.description})
      `;
    }

    // Seed default flags
    const defaultFlags = [
      { key: "signup",    label: "Sign Up",   description: "Allow new users to register an account" },
      { key: "dashboard", label: "Dashboard", description: "Show the dashboard page in the navigation" },
      { key: "menu",      label: "Navigation Menu", description: "Show navigation links in the sidebar" },
    ];
    for (const f of defaultFlags) {
      await prisma.$executeRaw`
        INSERT IGNORE INTO feature_flags (\`key\`, enabled, label, description)
        VALUES (${f.key}, 1, ${f.label}, ${f.description})
      `;
    }

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`role_permissions\` (
        \`role\`    VARCHAR(20) NOT NULL,
        \`nav_key\` VARCHAR(50) NOT NULL,
        PRIMARY KEY (\`role\`, \`nav_key\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`api_keys\` (
        \`id\`         INT NOT NULL AUTO_INCREMENT,
        \`key_hash\`   VARCHAR(64) NOT NULL,
        \`prefix\`     VARCHAR(12) NOT NULL,
        \`name\`       VARCHAR(200) NOT NULL,
        \`contact\`    VARCHAR(200) NOT NULL,
        \`expires_at\` DATETIME NULL,
        \`created_by\` INT NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`last_used\`  DATETIME NULL,
        \`active\`     TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`api_keys_prefix\` (\`prefix\`),
        KEY \`api_keys_created_by\` (\`created_by\`),
        CONSTRAINT \`api_keys_created_by_fk\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`sites\` (
        \`id\`               INT NOT NULL AUTO_INCREMENT,
        \`name\`             VARCHAR(200) NOT NULL,
        \`url\`              VARCHAR(500) NOT NULL,
        \`health_check_url\` VARCHAR(500) NOT NULL,
        \`environment\`      VARCHAR(20) NOT NULL,
        \`status\`           VARCHAR(20) NOT NULL DEFAULT 'unknown',
        \`last_checked\`     DATETIME(3) NULL DEFAULT NULL,
        \`created_at\`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`health_check_logs\` (
        \`id\`          INT NOT NULL AUTO_INCREMENT,
        \`site_id\`     INT NOT NULL,
        \`status\`      VARCHAR(20) NOT NULL,
        \`status_code\` INT NULL DEFAULT NULL,
        \`latency\`     INT NULL DEFAULT NULL,
        \`error\`       TEXT NULL DEFAULT NULL,
        \`created_at\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`health_check_logs_site_id_fk\` (\`site_id\`),
        CONSTRAINT \`health_check_logs_site_id_fk\` FOREIGN KEY (\`site_id\`) REFERENCES \`sites\` (\`id\`) ON DELETE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;


    // Seed default role permissions
    for (const [role, keys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const nav_key of keys) {
        await prisma.$executeRaw`
          INSERT IGNORE INTO role_permissions (role, nav_key) VALUES (${role}, ${nav_key})
        `;
      }
    }

    // Seed admin from env
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminHash  = process.env.ADMIN_PASSWORD_HASH;
    if (adminEmail && adminHash) {
      const existing = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM users WHERE email = ${adminEmail} LIMIT 1
      `;
      if (existing.length === 0) {
        await prisma.$executeRaw`
          INSERT INTO users (email, password_hash, role, status, created_at, updated_at)
          VALUES (${adminEmail}, ${adminHash}, 'admin', 'approved', NOW(), NOW())
        `;
      }
    }

    initialized = true;
  } catch (e) {
    console.error("[initDb] failed:", e);
    throw e;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
