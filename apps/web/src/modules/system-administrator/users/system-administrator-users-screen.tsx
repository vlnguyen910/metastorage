"use client";

import { UserRole } from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { roleHome } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";

const roleOptions = [
  { value: UserRole.STORAGE_CUSTOMER, label: "Khách thuê kho" },
  { value: UserRole.FACILITY_STAFF, label: "Nhân viên cơ sở" },
  { value: UserRole.FACILITY_MANAGER, label: "Quản lý cơ sở" },
  { value: UserRole.BUSINESS_OPERATIONS_MANAGER, label: "Quản lý vận hành" },
  { value: UserRole.SYSTEM_ADMINISTRATOR, label: "Quản trị hệ thống" },
] as const;

export function SystemAdministratorUsersScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const setSession = useAuthStore((state) => state.setSession);
  const { showToast } = useToast();
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: api.users.list });
  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      api.users.setRole(userId, role),
    onSuccess: async (updatedUser) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      showToast("Vai trò đã được cập nhật");

      if (session?.user.id === updatedUser.id) {
        try {
          const user = await api.auth.me();
          setSession({ user });
          router.replace(roleHome[user.role]);
        } catch {
          useAuthStore.getState().clearSession();
          router.replace("/login");
        }
      }
    },
    onError: () => showToast("Không thể cập nhật vai trò", "error"),
  });

  if (usersQuery.isLoading) return <LoadingState label="Đang tải người dùng…" />;
  if (usersQuery.isError) {
    return (
      <p className="rounded-xl bg-white p-6 text-red-700">Không thể tải danh sách người dùng.</p>
    );
  }

  return (
    <section className="grid gap-5">
      <header>
        <p className="m-0 text-sm font-bold text-primary">QUẢN TRỊ HỆ THỐNG</p>
        <h1 className="mb-2 mt-1 text-3xl font-bold">Người dùng và vai trò</h1>
        <p className="m-0 text-muted">
          Vai trò được lưu trong database và kiểm tra lại ở API. Nhân viên và quản lý cần được gán
          riêng vào cơ sở để truy cập dữ liệu cơ sở đó.
        </p>
      </header>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-[#f5f8f7] text-muted">
            <tr>
              <th className="px-5 py-4 font-semibold">Người dùng</th>
              <th className="px-5 py-4 font-semibold">Email</th>
              <th className="px-5 py-4 font-semibold">Trạng thái</th>
              <th className="px-5 py-4 font-semibold">Vai trò</th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.data?.map((user) => (
              <tr className="border-t border-line" key={user.id}>
                <td className="px-5 py-4 font-semibold">{user.name}</td>
                <td className="px-5 py-4 text-muted">{user.email}</td>
                <td className="px-5 py-4">
                  {user.status === "INACTIVE" ? "Đã khóa" : "Đang hoạt động"}
                </td>
                <td className="px-5 py-4">
                  <label className="sr-only" htmlFor={`role-${user.id}`}>
                    Vai trò của {user.name}
                  </label>
                  <select
                    className="min-h-10 rounded-lg border border-line bg-white px-3"
                    disabled={updateRole.isPending}
                    id={`role-${user.id}`}
                    value={user.role}
                    onChange={(event) =>
                      updateRole.mutate({ userId: user.id, role: event.target.value as UserRole })
                    }
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {usersQuery.data?.length === 0 ? (
          <p className="p-6 text-muted">Chưa có tài khoản nào.</p>
        ) : null}
      </div>
    </section>
  );
}
