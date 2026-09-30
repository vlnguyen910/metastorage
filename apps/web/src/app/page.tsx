import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  CalendarCheck2,
  KeyRound,
  MapPinned,
  ShieldCheck,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/public-layout";
import { buttonClassName } from "@/components/ui/button";
import { routes } from "@/config/routes";

const container =
  "mx-auto w-[min(1180px,calc(100%_-_40px))] max-[800px]:w-[min(100%_-_28px,680px)]";
const eyebrow =
  "mb-2.5 inline-block text-xs font-extrabold tracking-[0.13em] text-primary uppercase";

export default function HomePage() {
  return (
    <PublicLayout>
      <main>
        <section className="flex min-h-[680px] items-center overflow-hidden bg-[radial-gradient(circle_at_90%_20%,#dff0e8_0,transparent_32%),linear-gradient(135deg,#f7fbf9,#fafafa_65%)] max-[800px]:min-h-0">
          <div
            className={`${container} grid grid-cols-[1.02fr_0.98fr] items-center gap-[72px] py-[74px] max-[1024px]:gap-10 max-[800px]:grid-cols-1 max-[800px]:py-14`}
          >
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-2 text-sm font-bold text-primary">
                <BadgeCheck size={17} />
                An toàn · Linh hoạt · Minh bạch
              </span>
              <h1 className="my-6 text-[clamp(3.1rem,6vw,5.3rem)] leading-[0.98] font-bold max-[1024px]:text-[3.8rem] max-[560px]:text-[2.65rem]">
                Thêm không gian.
                <br />
                <em className="not-italic text-primary">Nhẹ mọi lo toan.</em>
              </h1>
              <p className="max-w-[610px] text-lg text-muted">
                Kho lưu trữ tự phục vụ cho đồ cá nhân, hồ sơ và hàng kinh doanh. Chọn kích thước,
                đặt chỗ và quản lý hoàn toàn trực tuyến.
              </p>
              <div className="my-7 flex gap-3 max-[560px]:flex-col">
                <Link
                  className={buttonClassName("primary", "min-h-[52px] px-6")}
                  href={routes.facilities}
                >
                  Tìm kho gần bạn <ArrowRight size={19} />
                </Link>
                <a className={buttonClassName("outline", "min-h-[52px] px-6")} href="#how-it-works">
                  Xem cách hoạt động
                </a>
              </div>
              <div className="flex flex-wrap gap-5 text-sm font-semibold text-slate-600">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  Camera 24/7
                </span>
                <span className="flex items-center gap-2">
                  <KeyRound className="size-4 text-primary" />
                  Quyền truy cập riêng
                </span>
                <span className="flex items-center gap-2">
                  <CalendarCheck2 className="size-4 text-primary" />
                  Không gian linh hoạt
                </span>
              </div>
            </div>
            <div className="relative grid min-h-[470px] place-items-center max-[800px]:min-h-[420px] max-[560px]:min-h-[330px]">
              <div className="relative h-[410px] w-full overflow-hidden rounded-[32px_32px_20px_20px] bg-[#173f35] p-6 shadow-card before:absolute before:inset-0 before:bg-[linear-gradient(120deg,transparent,rgb(255_255_255_/_8%))] max-[560px]:h-[300px] max-[560px]:p-[18px]">
                <div className="relative flex justify-between text-xl font-extrabold text-white">
                  <span>metastorage</span>
                  <small className="text-[0.7rem] tracking-[0.2em] text-[#b8d5ce]">
                    SELF STORAGE
                  </small>
                </div>
                <div className="relative mt-6 grid grid-cols-3 gap-3 max-[560px]:gap-2">
                  {[1, 2, 3, 4, 5, 6].map((item) => (
                    <span
                      className="relative h-[137px] rounded-[8px_8px_3px_3px] border-[3px] border-[#2b5449] bg-[repeating-linear-gradient(0deg,#f2f3ed_0_12px,#dfe5df_13px_15px)] max-[560px]:h-24"
                      key={item}
                    >
                      <i className="absolute top-2.5 left-2.5 rounded-[5px] bg-primary px-2 py-1 text-[0.66rem] text-white not-italic">
                        {String(item).padStart(2, "0")}
                      </i>
                    </span>
                  ))}
                </div>
                <div className="absolute bottom-[18px] left-6 flex items-center gap-3 rounded-[13px] bg-white p-3.5 max-[560px]:hidden">
                  <Warehouse className="text-primary" />
                  <div>
                    <strong className="block">24 unit</strong>
                    <small className="block text-muted">sẵn sàng hôm nay</small>
                  </div>
                </div>
              </div>
              <div className="absolute right-[-25px] bottom-2 grid rounded-card bg-white px-5 py-4 shadow-card max-[800px]:right-1 max-[560px]:bottom-0">
                <strong className="text-xl text-accent">4.9/5</strong>
                <span className="text-xs text-muted">Trải nghiệm khách hàng</span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-white">
          <div
            className={`${container} grid grid-cols-4 max-[800px]:grid-cols-2 [&>span]:border-r [&>span]:border-line [&>span]:p-6 [&>span]:text-center [&>span]:text-muted [&>span:nth-child(2)]:max-[800px]:border-r-0 [&>span:last-child]:border-r-0 [&_strong]:mb-1 [&_strong]:block [&_strong]:text-xl [&_strong]:text-primary`}
          >
            <span>
              <strong>3</strong>Cơ sở tại Việt Nam
            </span>
            <span>
              <strong>24/7</strong>Camera giám sát
            </span>
            <span>
              <strong>100%</strong>Giá thuê minh bạch
            </span>
            <span>
              <strong>5 phút</strong>Để hoàn tất đặt chỗ
            </span>
          </div>
        </section>

        <section className="py-[100px] max-[560px]:py-[70px]" id="how-it-works">
          <div className={container}>
            <div className="mb-8 flex justify-center text-center">
              <div>
                <span className={eyebrow}>Quy trình đơn giản</span>
                <h2 className="mb-2 text-[clamp(1.8rem,3vw,2.5rem)] font-bold">
                  Có kho phù hợp chỉ trong 3 bước
                </h2>
                <p className="m-0 text-muted">
                  Từ tìm kiếm đến xác nhận, mọi thông tin đều rõ ràng.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-5 max-[800px]:grid-cols-1">
              {[
                {
                  n: "01",
                  icon: MapPinned,
                  title: "Chọn cơ sở",
                  text: "Tìm địa điểm thuận tiện và kiểm tra số lượng kho còn trống.",
                },
                {
                  n: "02",
                  icon: Boxes,
                  title: "Chọn không gian",
                  text: "So sánh loại kho, kích thước và giá thuê phù hợp nhu cầu.",
                },
                {
                  n: "03",
                  icon: CalendarCheck2,
                  title: "Đặt chỗ an tâm",
                  text: "Chọn thời gian, xem báo giá và thanh toán tiền cọc an toàn.",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    className="relative rounded-card border border-line bg-white p-8 shadow-soft"
                    key={item.n}
                  >
                    <span className="absolute top-5 right-5 font-extrabold text-slate-400">
                      {item.n}
                    </span>
                    <Icon className="size-[52px] rounded-[14px] bg-primary p-3 text-white" />
                    <h3 className="mt-6 mb-2 text-xl font-bold">{item.title}</h3>
                    <p className="text-muted">{item.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-white py-[100px] max-[560px]:py-[70px]">
          <div
            className={`${container} grid grid-cols-2 items-center gap-20 max-[800px]:grid-cols-1`}
          >
            <div className="grid min-h-[410px] place-items-center overflow-hidden rounded-[28px] bg-gradient-to-br from-[#dceee8] to-[#a7c9be] max-[800px]:min-h-[330px]">
              <div className="relative grid h-[70%] w-[65%] place-items-center rounded-[14px_14px_5px_5px] border-[10px] border-primary bg-[repeating-linear-gradient(0deg,#f8f8f3_0_21px,#dfe5df_22px_25px)] text-primary">
                <Warehouse size={80} />
                <span className="absolute top-5 left-5 rounded-md bg-primary px-3 py-1.5 text-white">
                  HCM-01
                </span>
              </div>
            </div>
            <div>
              <span className={eyebrow}>Được thiết kế cho sự an tâm</span>
              <h2 className="mb-4 text-[2.6rem] font-bold">Không chỉ là một chỗ để đồ</h2>
              <p className="text-muted">
                Mỗi cơ sở metastorage được vận hành theo quy trình rõ ràng, từ kiểm tra kho đến quản
                lý quyền truy cập.
              </p>
              <ul className="my-6 grid list-none gap-3.5 p-0 [&_li]:flex [&_li]:items-center [&_li]:gap-3 [&_li]:font-semibold [&_svg]:text-primary">
                <li>
                  <ShieldCheck />
                  Giám sát và bảo vệ tại cơ sở
                </li>
                <li>
                  <KeyRound />
                  Khóa hoặc mã truy cập riêng
                </li>
                <li>
                  <CalendarCheck2 />
                  Theo dõi reservation trực tuyến
                </li>
                <li>
                  <BadgeCheck />
                  Tình trạng kho được kiểm tra định kỳ
                </li>
              </ul>
              <Link
                className="inline-flex items-center gap-2 font-extrabold text-primary [&_svg]:size-4"
                href={routes.facilities}
              >
                Khám phá các cơ sở <ArrowRight />
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-primary py-[70px] text-white">
          <div
            className={`${container} flex items-center justify-between gap-8 max-[800px]:flex-col max-[800px]:items-start`}
          >
            <div>
              <span className="mb-2.5 inline-block text-xs font-extrabold tracking-[0.13em] text-[#cce7df] uppercase">
                Sẵn sàng bắt đầu?
              </span>
              <h2 className="mb-2 text-[2.45rem] font-bold max-[560px]:text-3xl">
                Tìm không gian phù hợp ngay hôm nay.
              </h2>
              <p className="m-0 text-[#cce0db]">
                Giá từ 750.000 ₫/tháng. Không có chi phí ẩn trong MVP.
              </p>
            </div>
            <Link
              className={buttonClassName(
                "outline",
                "min-h-[52px] border-white bg-white px-6 text-primary hover:bg-slate-50",
              )}
              href={routes.facilities}
            >
              Xem kho còn trống <ArrowRight />
            </Link>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
