from sqlalchemy import Column, String, Boolean, DateTime, Date, Text, ARRAY, Integer, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, INET
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import uuid
from .base import Base, IDMixin, TimestampMixin

class Person(Base, IDMixin, TimestampMixin):
    __tablename__ = "persons"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    nric_fin: Mapped[str] = mapped_column(String(255), nullable=True)  # AES-256 Encrypted (stored as ciphertext)
    nationality: Mapped[str] = mapped_column(String(50), nullable=True)
    race: Mapped[str] = mapped_column(String(50), nullable=True)
    religion: Mapped[str] = mapped_column(String(50), nullable=True)
    date_of_birth: Mapped[datetime.date] = mapped_column(Date, nullable=True)
    gender: Mapped[str] = mapped_column(String(10), nullable=True)
    contact_number: Mapped[str] = mapped_column(String(20), nullable=True)
    mobile_number: Mapped[str] = mapped_column(String(20), nullable=True)
    whatsapp_number: Mapped[str] = mapped_column(String(20), nullable=True)
    personal_email: Mapped[str] = mapped_column(String(255), nullable=True)
    language: Mapped[str] = mapped_column(String(50), nullable=True)
    highest_education: Mapped[str] = mapped_column(String(100), nullable=True)
    pr_start_date: Mapped[datetime.date] = mapped_column(Date, nullable=True)  # For SPR employees
    work_pass_start: Mapped[datetime.date] = mapped_column(Date, nullable=True)  # For Foreigners
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=True)  # Links spouses for family pools
    address: Mapped[str] = mapped_column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("tenant_id", "nric_fin", name="uq_persons_nric"),)

class Department(Base, IDMixin, TimestampMixin):
    __tablename__ = "departments"

    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    parent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (UniqueConstraint("entity_id", "code", name="uq_department_code"),)

class Grade(Base, IDMixin, TimestampMixin):
    __tablename__ = "grades"

    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (UniqueConstraint("entity_id", "code", name="uq_grade_code"),)

class Group(Base, IDMixin, TimestampMixin):
    __tablename__ = "groups"

    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (UniqueConstraint("entity_id", "code", name="uq_group_code"),)

class Customer(Base, IDMixin, TimestampMixin):
    __tablename__ = "customers"

    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=True)
    uen: Mapped[str] = mapped_column(String(50), nullable=True)
    billing_address: Mapped[str] = mapped_column(Text, nullable=True)
    contact_name: Mapped[str] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=True)
    contact_number: Mapped[str] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (UniqueConstraint("entity_id", "code", name="uq_customer_code"),)

class BankAccount(Base, IDMixin, TimestampMixin):
    __tablename__ = "bank_accounts"

    person_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("persons.id", ondelete="CASCADE"), nullable=False)
    bank_name: Mapped[str] = mapped_column(String(100), nullable=False)
    account_number: Mapped[str] = mapped_column(String(255), nullable=False)  # AES-256 Encrypted (stored as ciphertext)
    account_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

class Employment(Base, IDMixin, TimestampMixin):
    __tablename__ = "employments"

    person_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("persons.id", ondelete="CASCADE"), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    employee_code: Mapped[str] = mapped_column(String(50), nullable=True)
    employment_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # full_time | part_time | contract | director | intern
    job_title: Mapped[str] = mapped_column(String(100), nullable=True)
    department_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    grade_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("grades.id"), nullable=True)
    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=True)
    citizenship_type: Mapped[str] = mapped_column(String(20), default="citizen")
    # citizen | pr | ep | s_pass | wp | dp | ltvp
    pr_year: Mapped[int] = mapped_column(Integer, nullable=True)
    work_pass_type: Mapped[str] = mapped_column(String(50), nullable=True)
    work_pass_no: Mapped[str] = mapped_column(String(50), nullable=True)
    work_pass_expiry: Mapped[datetime.date] = mapped_column(Date, nullable=True)
    join_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    resign_date: Mapped[datetime.date] = mapped_column(Date, nullable=True)
    cessation_date: Mapped[datetime.date] = mapped_column(Date, nullable=True)
    probation_end_date: Mapped[datetime.date] = mapped_column(Date, nullable=True)
    designation: Mapped[str] = mapped_column(String(100), nullable=True)
    working_days_per_week: Mapped[float] = mapped_column(Numeric(3, 1), nullable=True)
    rest_day: Mapped[str] = mapped_column(String(20), nullable=True)
    work_hours_per_day: Mapped[float] = mapped_column(Numeric(4, 1), nullable=True)
    normal_work_hours_per_week: Mapped[float] = mapped_column(Numeric(4, 1), nullable=True)
    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    payment_mode: Mapped[str] = mapped_column(String(20), default="bank_transfer")
    bank_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bank_accounts.id"), nullable=True)
    is_ot_eligible: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (UniqueConstraint("person_id", "entity_id", "join_date", name="uq_employments_period"),)
