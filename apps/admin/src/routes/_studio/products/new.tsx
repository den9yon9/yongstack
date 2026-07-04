import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { Breadcrumb } from "../../../components/Breadcrumb";
import { Card } from "../../../components/ui/Card";

export const Route = createFileRoute("/_studio/products/new")({
  staticData: { title: "新建商品", showInNav: false },
  component: NewProductPage,
});

function NewProductPage() {
  return (
    <div>
      <Breadcrumb />
      <Card>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary-soft">
            <FileText className="size-8 text-primary" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-text">新建商品</h2>
          <p className="mb-6 max-w-sm text-sm text-text-secondary">
            商品表单待实现。包含基本信息、SKU 管理、商品详情、图片上传等功能。
          </p>
        </div>
      </Card>
    </div>
  );
}
