from dataclasses import dataclass


@dataclass
class AuthUser:
    id: str
    tenant_id: str | None
    roles: list[str]
    email: str
    name: str

    @property
    def is_superadmin(self) -> bool:
        return "superadmin" in self.roles

    @property
    def is_operator(self) -> bool:
        return "operator" in self.roles or "tenant_admin" in self.roles
